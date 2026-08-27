#!/usr/bin/env python3
"""GoreeCloud Mail consumer boundary for Wardveil attachment scan findings.

Mail treats message bodies, links, HTML, remote resources, and attachments as
untrusted input. This module consumes Wardveil Scan evidence; it does not talk
directly to ClamAV and it does not execute quarantine by itself.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from hashlib import sha256
from typing import Mapping

WARDVEIL_RUNTIME_CONTRACT_VERSION = "0.1.0"
EXPECTED_RESOURCE_TYPE = "mail_attachment"
SCAN_RESULTS = {"clean", "suspicious", "malicious", "unknown", "unsupported"}


def _utc(value: datetime | None = None) -> datetime:
    value = value or datetime.now(timezone.utc)
    if value.tzinfo is None:
        raise ValueError("timestamp_must_be_timezone_aware")
    return value.astimezone(timezone.utc)


def _parse_instant(value: object) -> datetime:
    if not isinstance(value, str) or not value:
        raise ValueError("missing_timestamp")
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("timestamp_must_be_timezone_aware")
    return parsed.astimezone(timezone.utc)


@dataclass(frozen=True)
class MailAttachment:
    message_id: str
    attachment_id: str
    filename: str
    media_type: str
    size_bytes: int

    @property
    def resource_id(self) -> str:
        return f"mail:{self.message_id}:attachment:{self.attachment_id}"

    def validate(self) -> None:
        if not self.message_id or not self.attachment_id:
            raise ValueError("attachment_identity_required")
        if self.size_bytes < 0:
            raise ValueError("invalid_attachment_size")


@dataclass(frozen=True)
class WardveilScanEnvelope:
    resource_id: str
    resource_digest_sha256: str
    scan_record: Mapping[str, object]


@dataclass(frozen=True)
class AttachmentSecurityDecision:
    disposition: str
    can_open: bool
    can_download: bool
    quarantine_required: bool
    reason_codes: tuple[str, ...]
    evidence_refs: tuple[str, ...]
    scan_record_id: str | None

    def as_dict(self) -> dict:
        return {
            "disposition": self.disposition,
            "can_open": self.can_open,
            "can_download": self.can_download,
            "quarantine_required": self.quarantine_required,
            "reason_codes": list(self.reason_codes),
            "evidence_refs": list(self.evidence_refs),
            "scan_record_id": self.scan_record_id,
        }

    def quarantine_handoff(self, *, attachment: MailAttachment) -> dict | None:
        if not self.quarantine_required:
            return None
        return {
            "action": "quarantine",
            "scope": {
                "resource_type": EXPECTED_RESOURCE_TYPE,
                "resource_id": attachment.resource_id,
            },
            "source_scan_record_id": self.scan_record_id,
            "evidence_refs": list(self.evidence_refs),
            "requires_explicit_executor_authority": True,
            "destructive_action": False,
        }


def _blocked(reason: str, *, record_id: str | None = None, evidence=()) -> AttachmentSecurityDecision:
    return AttachmentSecurityDecision(
        "blocked_unverified",
        False,
        False,
        False,
        (reason,),
        tuple(evidence),
        record_id,
    )


def evaluate_attachment_scan(
    attachment: MailAttachment,
    content: bytes,
    envelope: WardveilScanEnvelope,
    *,
    now: datetime | None = None,
) -> AttachmentSecurityDecision:
    """Map a Wardveil Scan result to Mail attachment behavior.

    Clean is the only result that can enable attachment open/download and only
    when all binding, authority, evidence, and freshness checks pass. Positive
    malicious evidence remains blocking even after its original validity window
    because it is bound to the immutable content digest; expiry never upgrades
    a known-malicious digest into an allowed attachment.
    """
    attachment.validate()
    observed_now = _utc(now)
    expected_digest = sha256(content).hexdigest()

    if envelope.resource_id != attachment.resource_id:
        return _blocked("resource_binding_mismatch")
    if envelope.resource_digest_sha256.lower() != expected_digest:
        return _blocked("content_digest_mismatch")

    record = dict(envelope.scan_record)
    record_id = record.get("record_id") if isinstance(record.get("record_id"), str) else None
    evidence = tuple(ref for ref in (record.get("evidence_refs") or ()) if isinstance(ref, str) and ref)

    if record.get("contract_version") != WARDVEIL_RUNTIME_CONTRACT_VERSION:
        return _blocked("unsupported_wardveil_runtime_contract", record_id=record_id, evidence=evidence)
    if record.get("record_type") != "scan_finding":
        return _blocked("unexpected_wardveil_record_type", record_id=record_id, evidence=evidence)

    producer = record.get("producer")
    if not isinstance(producer, Mapping) or producer.get("authoritative") is not True or not producer.get("id"):
        return _blocked("non_authoritative_scan_record", record_id=record_id, evidence=evidence)

    scope = record.get("scope")
    if not isinstance(scope, Mapping):
        return _blocked("missing_scan_scope", record_id=record_id, evidence=evidence)
    if scope.get("resource_type") != EXPECTED_RESOURCE_TYPE or scope.get("resource_id") != attachment.resource_id:
        return _blocked("scan_scope_mismatch", record_id=record_id, evidence=evidence)

    result = record.get("scan_result")
    if result not in SCAN_RESULTS:
        return _blocked("unsupported_scan_result", record_id=record_id, evidence=evidence)

    try:
        observed_at = _parse_instant(record.get("observed_at"))
        valid_until = _parse_instant(record.get("valid_until"))
    except (TypeError, ValueError):
        return _blocked("invalid_scan_evidence_time", record_id=record_id, evidence=evidence)

    if observed_at > observed_now:
        return _blocked("future_dated_scan_evidence", record_id=record_id, evidence=evidence)
    if valid_until <= observed_at:
        return _blocked("invalid_scan_validity_window", record_id=record_id, evidence=evidence)

    if result == "malicious":
        reasons = ["wardveil_scan_malicious"]
        if observed_now > valid_until:
            reasons.append("expired_malicious_evidence_remains_blocking_for_bound_digest")
        return AttachmentSecurityDecision(
            "block_quarantine",
            False,
            False,
            True,
            tuple(reasons),
            evidence,
            record_id,
        )

    if result == "suspicious":
        return AttachmentSecurityDecision(
            "hold_review",
            False,
            False,
            False,
            ("wardveil_scan_suspicious",),
            evidence,
            record_id,
        )

    if result in {"unknown", "unsupported"}:
        return _blocked(f"wardveil_scan_{result}", record_id=record_id, evidence=evidence)

    # Only a clean result can reach this point.
    if not evidence:
        return _blocked("clean_scan_missing_evidence_refs", record_id=record_id)
    if observed_now > valid_until:
        return _blocked("clean_scan_evidence_expired", record_id=record_id, evidence=evidence)

    return AttachmentSecurityDecision(
        "allow",
        True,
        True,
        False,
        ("wardveil_scan_clean_current",),
        evidence,
        record_id,
    )
