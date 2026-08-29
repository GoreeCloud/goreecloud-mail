#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "contracts" / "wardveil.mail-attachment-scan.json"
REFERENCE = ROOT / "reference" / "mail_attachment_security.py"
CLIENT = ROOT / "server" / "wardveil-scan-client.js"
DOC = ROOT / "docs" / "wardveil-attachment-scanning.md"
PLATFORM = ROOT / "docs" / "PLATFORM_CONFORMANCE.md"
README = ROOT / "README.md"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(f"GoreeCloud Mail Wardveil validation failed: {message}")


def main() -> None:
    for path in (CONTRACT, REFERENCE, CLIENT, DOC, PLATFORM, README):
        require(path.is_file(), f"missing required file: {path.relative_to(ROOT)}")

    contract = json.loads(CONTRACT.read_text(encoding="utf-8"))
    reference = REFERENCE.read_text(encoding="utf-8")
    client = CLIENT.read_text(encoding="utf-8")
    doc = DOC.read_text(encoding="utf-8").lower()
    platform = PLATFORM.read_text(encoding="utf-8").lower()
    readme = README.read_text(encoding="utf-8").lower()

    require(contract.get("contract_version") == "0.2.0", "unexpected Mail integration contract version")
    require(contract.get("consumer") == "GoreeCloud Mail", "unexpected consumer identity")
    require(contract.get("wardveil_runtime_contract_version") == "0.1.0", "unexpected Wardveil runtime contract")
    require(contract.get("resource_type") == "mail_attachment", "unexpected attachment resource type")
    require(contract.get("direct_clamav_access_allowed") is False, "Mail must not access ClamAV directly")
    require(contract.get("attachment_digest_binding_required") is True, "attachment digest binding is mandatory")
    require(contract.get("authoritative_scan_record_required") is True, "authoritative scan evidence is mandatory")
    require(contract.get("application_scan_result_field") == "result", "canonical application result field must be result")
    require(contract.get("obsolete_application_scan_result_field_rejected") == "scan_result", "obsolete scan_result field must be rejected")
    require(contract.get("clean_requires_current_unexpired_evidence") is True, "clean evidence must be current")
    require(contract.get("clean_requires_evidence_refs") is True, "clean evidence references are mandatory")
    require(contract.get("malicious_digest_match_remains_blocking_after_evidence_expiry") is True, "known-malicious digest must remain blocking")
    require(contract.get("production_runtime_status") == "unaccepted", "source must not claim production acceptance")

    transport = contract.get("transport") or {}
    require(transport.get("source_compatible_wardveil_revision") == "842d792c128906e70d41028e3153ea527c1d1899", "unexpected Wardveil transport source revision")
    require(transport.get("endpoint_path") == "/v1/scan", "unexpected Wardveil Scan endpoint path")
    require(transport.get("ipv4_loopback_http_only") is True, "Mail transport must remain loopback-only")
    require(transport.get("redirects_allowed") is False, "Mail transport must reject redirects")
    require(transport.get("default_caller_id") == "goreecloud-mail", "unexpected Mail Wardveil caller identity")
    require(transport.get("key_scoped_request_signature_required") is True, "signed requests are mandatory")
    require(transport.get("signature_algorithm") == "HMAC-SHA256-reference-transport", "unexpected reference signature algorithm")
    require(transport.get("signature_contract_version") == "0.1.0", "unexpected signature contract version")
    require(transport.get("response_correlation_required") is True, "response correlation binding is mandatory")
    require(transport.get("response_resource_binding_required") is True, "response resource binding is mandatory")
    require(transport.get("response_size_bounded") is True, "response size must be bounded")
    require(transport.get("production_service_identity_accepted") is False, "reference transport must not claim production service identity")
    require(transport.get("distributed_replay_protection_accepted") is False, "source transport must not claim distributed replay protection")

    expected_signed_fields = {
        "caller_id",
        "key_id",
        "timestamp",
        "nonce",
        "action",
        "resource_type",
        "resource_id",
        "correlation_id",
        "size_bytes",
        "digest_sha256",
    }
    require(set(transport.get("signature_binds") or ()) == expected_signed_fields, "Wardveil signature binding set changed")

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
        'record.get("result")',
        '"obsolete_scan_result_field"',
        '"content_digest_mismatch"',
        '"non_authoritative_scan_record"',
        '"clean_scan_evidence_expired"',
        '"wardveil_scan_malicious"',
        '"requires_explicit_executor_authority": True',
        '"destructive_action": False',
    ):
        require(token in reference, f"reference implementation missing invariant: {token}")

    for token in (
        "WARDVEIL_SCAN_CONTRACT_VERSION = '0.1.0'",
        "MAIL_ATTACHMENT_RESOURCE_TYPE = 'mail_attachment'",
        "endpoint.protocol !== 'http:'",
        "endpoint.hostname !== '127.0.0.1'",
        "redirect: 'manual'",
        "'x-wardveil-caller-id'",
        "'x-wardveil-key-id'",
        "'x-wardveil-timestamp'",
        "'x-wardveil-nonce'",
        "'x-wardveil-digest-sha256'",
        "'x-wardveil-correlation-id'",
        "'x-wardveil-signature'",
        "Object.hasOwn(record, 'scan_result')",
        "record.result",
        "response correlation mismatch",
        "response resource binding mismatch",
    ):
        require(token in client, f"Mail Wardveil transport missing invariant: {token}")

    for phrase in (
        "mail does not connect directly to clamav",
        "quarantine is not deletion",
        "unknown and unsupported results fail closed",
        "production runtime status remains `unaccepted`",
        "privacy shield boundary",
        "everkeep integration",
        "hardened wardveil scan transport",
        "scan_record.result",
    ):
        require(phrase in doc, f"integration documentation missing boundary: {phrase}")

    for phrase in ("wardveil security", "privacy shield", "everkeep", "glaze ui"):
        require(phrase in platform, f"platform conformance missing mandatory system: {phrase}")

    require("wardveil attachment scanning" in readme, "README must expose Wardveil attachment integration")
    require("production deployment is not approved" in readme, "README must preserve production gate")

    print("GoreeCloud Mail Wardveil attachment integration validation passed.")


if __name__ == "__main__":
    main()
