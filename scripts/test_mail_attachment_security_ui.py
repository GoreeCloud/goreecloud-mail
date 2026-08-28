#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from reference.mail_attachment_security import AttachmentSecurityDecision  # noqa: E402
from reference.mail_attachment_security_ui import present_attachment_security  # noqa: E402


def decision(
    disposition: str,
    *,
    can_open: bool = False,
    can_download: bool = False,
    quarantine_required: bool = False,
    reasons: tuple[str, ...] = (),
    evidence: tuple[str, ...] = (),
) -> AttachmentSecurityDecision:
    return AttachmentSecurityDecision(
        disposition=disposition,
        can_open=can_open,
        can_download=can_download,
        quarantine_required=quarantine_required,
        reason_codes=reasons,
        evidence_refs=evidence,
        scan_record_id="scan-1",
    )


def test_current_clean_evidence_is_the_only_open_state():
    presentation = present_attachment_security(
        decision(
            "allow",
            can_open=True,
            can_download=True,
            reasons=("wardveil_scan_clean_current",),
            evidence=("wardveil:evidence:scan-1",),
        )
    )
    assert presentation.state == "scan-clear"
    assert presentation.can_open and presentation.can_download
    assert "safe" not in presentation.detail.lower()


def test_allow_without_evidence_fails_closed():
    presentation = present_attachment_security(
        decision(
            "allow",
            can_open=True,
            can_download=True,
            reasons=("wardveil_scan_clean_current",),
        )
    )
    assert presentation.state == "verification-unavailable"
    assert not presentation.can_open and not presentation.can_download


def test_suspicious_maps_to_review_hold():
    presentation = present_attachment_security(
        decision("hold_review", reasons=("wardveil_scan_suspicious",), evidence=("evidence:1",))
    )
    assert presentation.state == "held-for-review"
    assert not presentation.can_open and not presentation.can_download


def test_malicious_maps_to_security_block():
    presentation = present_attachment_security(
        decision(
            "block_quarantine",
            quarantine_required=True,
            reasons=("wardveil_scan_malicious",),
            evidence=("evidence:1",),
        )
    )
    assert presentation.state == "blocked-by-security"
    assert not presentation.can_open and not presentation.can_download


def test_unknown_or_inconsistent_decision_fails_closed():
    for candidate in (
        decision("blocked_unverified", reasons=("wardveil_scan_unknown",)),
        decision("allow", can_open=True, can_download=False, reasons=("wardveil_scan_clean_current",), evidence=("evidence:1",)),
        decision("unexpected", can_open=True, can_download=True, evidence=("evidence:1",)),
    ):
        presentation = present_attachment_security(candidate)
        assert presentation.state == "verification-unavailable"
        assert not presentation.can_open and not presentation.can_download


def main() -> None:
    tests = [name for name, value in globals().items() if name.startswith("test_") and callable(value)]
    for name in sorted(tests):
        globals()[name]()
    print(f"GoreeCloud Mail Glaze attachment security presentation tests passed: {len(tests)}")


if __name__ == "__main__":
    main()
