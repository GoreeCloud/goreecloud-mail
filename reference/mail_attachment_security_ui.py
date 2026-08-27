#!/usr/bin/env python3
"""Glaze UI presentation boundary for GoreeCloud Mail attachment security.

This module translates an already-authoritative Mail attachment security decision
into conservative presentation state. It never scans content, changes Wardveil
findings, or upgrades missing/invalid evidence into an allowed UI state.
"""
from __future__ import annotations

from dataclasses import dataclass

from mail_attachment_security import AttachmentSecurityDecision


@dataclass(frozen=True)
class AttachmentSecurityPresentation:
    state: str
    headline: str
    detail: str
    can_open: bool
    can_download: bool
    show_evidence: bool
    evidence_refs: tuple[str, ...]
    reason_codes: tuple[str, ...]

    def as_dict(self) -> dict:
        return {
            "state": self.state,
            "headline": self.headline,
            "detail": self.detail,
            "can_open": self.can_open,
            "can_download": self.can_download,
            "show_evidence": self.show_evidence,
            "evidence_refs": list(self.evidence_refs),
            "reason_codes": list(self.reason_codes),
        }


_PRESENTATION_COPY = {
    "scan-clear": (
        "Scan clear",
        "Wardveil found no known threat in the current scan evidence.",
    ),
    "held-for-review": (
        "Held for review",
        "Wardveil flagged this attachment for additional review.",
    ),
    "blocked-by-security": (
        "Blocked by security",
        "Wardveil identified evidence that requires this attachment to remain blocked.",
    ),
    "verification-unavailable": (
        "Verification unavailable",
        "Current authoritative scan evidence is not available for this attachment.",
    ),
}


def present_attachment_security(decision: AttachmentSecurityDecision) -> AttachmentSecurityPresentation:
    """Create a fail-closed Glaze UI state from a Mail security decision."""
    state = "verification-unavailable"
    can_open = False
    can_download = False

    clean_is_authoritative = (
        decision.disposition == "allow"
        and decision.can_open is True
        and decision.can_download is True
        and decision.quarantine_required is False
        and "wardveil_scan_clean_current" in decision.reason_codes
        and bool(decision.evidence_refs)
    )
    if clean_is_authoritative:
        state = "scan-clear"
        can_open = True
        can_download = True
    elif decision.disposition == "hold_review":
        state = "held-for-review"
    elif decision.disposition == "block_quarantine" or decision.quarantine_required:
        state = "blocked-by-security"

    headline, detail = _PRESENTATION_COPY[state]
    return AttachmentSecurityPresentation(
        state=state,
        headline=headline,
        detail=detail,
        can_open=can_open,
        can_download=can_download,
        show_evidence=bool(decision.evidence_refs),
        evidence_refs=tuple(decision.evidence_refs),
        reason_codes=tuple(decision.reason_codes),
    )
