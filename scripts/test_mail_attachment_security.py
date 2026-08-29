#!/usr/bin/env python3
from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from reference.mail_attachment_security import (  # noqa: E402
    MailAttachment,
    WardveilScanEnvelope,
    evaluate_attachment_scan,
)

NOW = datetime(2026, 8, 27, 12, 0, tzinfo=timezone.utc)
CONTENT = b"example attachment bytes"
ATTACHMENT = MailAttachment(
    message_id="message-1",
    attachment_id="attachment-1",
    filename="invoice.pdf",
    media_type="application/pdf",
    size_bytes=len(CONTENT),
)


def record(result: str, *, authoritative: bool = True, observed_at=None, valid_until=None, evidence=True, resource_id=None):
    observed_at = observed_at or NOW - timedelta(minutes=1)
    valid_until = valid_until or NOW + timedelta(minutes=9)
    return {
        "contract_version": "0.1.0",
        "record_type": "scan_finding",
        "record_id": f"scan-{result}",
        "correlation_id": "mail-scan-correlation-1",
        "producer": {"id": "wardveil-scan-mail", "authoritative": authoritative},
        "scope": {
            "resource_type": "mail_attachment",
            "resource_id": resource_id or ATTACHMENT.resource_id,
        },
        "observed_at": observed_at.isoformat(),
        "valid_until": valid_until.isoformat(),
        "evidence_refs": ["wardveil:evidence:scan-1"] if evidence else [],
        "result": result,
    }


def envelope(scan_record=None, *, digest=None, resource_id=None):
    return WardveilScanEnvelope(
        resource_id=resource_id or ATTACHMENT.resource_id,
        resource_digest_sha256=digest or sha256(CONTENT).hexdigest(),
        scan_record=scan_record or record("clean"),
    )


def test_current_clean_allows_open_and_download():
    decision = evaluate_attachment_scan(ATTACHMENT, CONTENT, envelope(), now=NOW)
    assert decision.disposition == "allow"
    assert decision.can_open and decision.can_download
    assert not decision.quarantine_required


def test_obsolete_scan_result_field_fails_closed():
    obsolete = record("clean")
    obsolete["scan_result"] = obsolete.pop("result")
    decision = evaluate_attachment_scan(ATTACHMENT, CONTENT, envelope(obsolete), now=NOW)
    assert decision.disposition == "blocked_unverified"
    assert "obsolete_scan_result_field" in decision.reason_codes


def test_expired_clean_fails_closed():
    expired = record("clean", valid_until=NOW - timedelta(seconds=1))
    decision = evaluate_attachment_scan(ATTACHMENT, CONTENT, envelope(expired), now=NOW)
    assert decision.disposition == "blocked_unverified"
    assert "clean_scan_evidence_expired" in decision.reason_codes


def test_clean_without_evidence_fails_closed():
    decision = evaluate_attachment_scan(ATTACHMENT, CONTENT, envelope(record("clean", evidence=False)), now=NOW)
    assert decision.disposition == "blocked_unverified"
    assert "clean_scan_missing_evidence_refs" in decision.reason_codes


def test_malicious_requires_quarantine_handoff():
    decision = evaluate_attachment_scan(ATTACHMENT, CONTENT, envelope(record("malicious")), now=NOW)
    assert decision.disposition == "block_quarantine"
    assert decision.quarantine_required
    assert not decision.can_open and not decision.can_download
    handoff = decision.quarantine_handoff(attachment=ATTACHMENT)
    assert handoff is not None
    assert handoff["requires_explicit_executor_authority"] is True
    assert handoff["destructive_action"] is False


def test_expired_malicious_remains_blocking_for_same_digest():
    expired = record("malicious", valid_until=NOW - timedelta(seconds=1))
    decision = evaluate_attachment_scan(ATTACHMENT, CONTENT, envelope(expired), now=NOW)
    assert decision.disposition == "block_quarantine"
    assert "expired_malicious_evidence_remains_blocking_for_bound_digest" in decision.reason_codes


def test_suspicious_holds_without_claiming_confirmed_malice():
    decision = evaluate_attachment_scan(ATTACHMENT, CONTENT, envelope(record("suspicious")), now=NOW)
    assert decision.disposition == "hold_review"
    assert not decision.quarantine_required
    assert not decision.can_open and not decision.can_download


def test_unknown_and_unsupported_are_not_clean():
    for result in ("unknown", "unsupported"):
        decision = evaluate_attachment_scan(ATTACHMENT, CONTENT, envelope(record(result)), now=NOW)
        assert decision.disposition == "blocked_unverified"
        assert not decision.can_open and not decision.can_download


def test_digest_mismatch_fails_closed():
    decision = evaluate_attachment_scan(ATTACHMENT, CONTENT, envelope(digest="0" * 64), now=NOW)
    assert decision.disposition == "blocked_unverified"
    assert "content_digest_mismatch" in decision.reason_codes


def test_scope_mismatch_fails_closed():
    mismatched = record("clean", resource_id="mail:other:attachment:other")
    decision = evaluate_attachment_scan(ATTACHMENT, CONTENT, envelope(mismatched), now=NOW)
    assert decision.disposition == "blocked_unverified"
    assert "scan_scope_mismatch" in decision.reason_codes


def test_non_authoritative_record_fails_closed():
    decision = evaluate_attachment_scan(ATTACHMENT, CONTENT, envelope(record("clean", authoritative=False)), now=NOW)
    assert decision.disposition == "blocked_unverified"
    assert "non_authoritative_scan_record" in decision.reason_codes


def main():
    tests = [name for name, value in globals().items() if name.startswith("test_") and callable(value)]
    for name in sorted(tests):
        globals()[name]()
    print(f"GoreeCloud Mail Wardveil attachment security tests passed: {len(tests)}")


if __name__ == "__main__":
    main()
