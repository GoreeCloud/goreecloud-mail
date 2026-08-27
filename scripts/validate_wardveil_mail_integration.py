#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "contracts" / "wardveil.mail-attachment-scan.json"
REFERENCE = ROOT / "reference" / "mail_attachment_security.py"
DOC = ROOT / "docs" / "wardveil-attachment-scanning.md"
PLATFORM = ROOT / "docs" / "PLATFORM_CONFORMANCE.md"
README = ROOT / "README.md"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(f"GoreeCloud Mail Wardveil validation failed: {message}")


def main() -> None:
    for path in (CONTRACT, REFERENCE, DOC, PLATFORM, README):
        require(path.is_file(), f"missing required file: {path.relative_to(ROOT)}")

    contract = json.loads(CONTRACT.read_text(encoding="utf-8"))
    reference = REFERENCE.read_text(encoding="utf-8")
    doc = DOC.read_text(encoding="utf-8").lower()
    platform = PLATFORM.read_text(encoding="utf-8").lower()
    readme = README.read_text(encoding="utf-8").lower()

    require(contract.get("consumer") == "GoreeCloud Mail", "unexpected consumer identity")
    require(contract.get("wardveil_runtime_contract_version") == "0.1.0", "unexpected Wardveil runtime contract")
    require(contract.get("resource_type") == "mail_attachment", "unexpected attachment resource type")
    require(contract.get("direct_clamav_access_allowed") is False, "Mail must not access ClamAV directly")
    require(contract.get("attachment_digest_binding_required") is True, "attachment digest binding is mandatory")
    require(contract.get("authoritative_scan_record_required") is True, "authoritative scan evidence is mandatory")
    require(contract.get("clean_requires_current_unexpired_evidence") is True, "clean evidence must be current")
    require(contract.get("clean_requires_evidence_refs") is True, "clean evidence references are mandatory")
    require(contract.get("malicious_digest_match_remains_blocking_after_evidence_expiry") is True, "known-malicious digest must remain blocking")
    require(contract.get("production_runtime_status") == "unaccepted", "source must not claim production acceptance")

    mapping = contract.get("result_mapping") or {}
    require(mapping.get("clean") == "allow_only_when_all_validation_passes", "clean mapping is not fail closed")
    require(mapping.get("malicious") == "block_and_request_quarantine", "malicious mapping must request quarantine")
    require(mapping.get("unknown") == "block_unverified", "unknown scan result must fail closed")
    require(mapping.get("unsupported") == "block_unverified", "unsupported scan result must fail closed")

    quarantine = contract.get("quarantine") or {}
    require(quarantine.get("requires_explicit_executor_authority") is True, "quarantine must require explicit authority")
    require(quarantine.get("is_deletion") is False, "quarantine must not equal deletion")
    require(quarantine.get("mail_consumer_executes_quarantine_directly") is False, "Mail consumer must not execute quarantine directly")

    privacy = contract.get("privacy") or {}
    require(privacy.get("raw_attachment_content_in_shared_security_records") is False, "raw attachment content must not enter shared security records")
    require(privacy.get("credentials_or_provider_tokens_in_security_records") is False, "provider credentials must not enter security records")

    for token in (
        'EXPECTED_RESOURCE_TYPE = "mail_attachment"',
        'sha256(content).hexdigest()',
        '"content_digest_mismatch"',
        '"non_authoritative_scan_record"',
        '"clean_scan_evidence_expired"',
        '"wardveil_scan_malicious"',
        '"requires_explicit_executor_authority": True',
        '"destructive_action": False',
    ):
        require(token in reference, f"reference implementation missing invariant: {token}")

    for phrase in (
        "mail does not connect directly to clamav",
        "quarantine is not deletion",
        "unknown and unsupported results fail closed",
        "production runtime status remains `unaccepted`",
        "privacy shield boundary",
        "everkeep integration",
    ):
        require(phrase in doc, f"integration documentation missing boundary: {phrase}")

    for phrase in ("wardveil security", "privacy shield", "everkeep", "glaze ui"):
        require(phrase in platform, f"platform conformance missing mandatory system: {phrase}")

    require("wardveil attachment scanning" in readme, "README must expose Wardveil attachment integration")
    require("production deployment is not approved" in readme, "README must preserve production gate")

    print("GoreeCloud Mail Wardveil attachment integration validation passed.")


if __name__ == "__main__":
    main()
