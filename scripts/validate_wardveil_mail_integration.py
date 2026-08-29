#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "contracts" / "wardveil.mail-attachment-scan.json"
REFERENCE = ROOT / "reference" / "mail_attachment_security.py"
CLIENT = ROOT / "server" / "wardveil-scan-client.js"
DELIVERY = ROOT / "server" / "attachment-delivery-service.js"
PROVENANCE = ROOT / "server" / "attachment-scan-provenance-store.js"
OUTGOING_GATE = ROOT / "server" / "gmail-outgoing-attachment-security.js"
OUTGOING_PROVENANCE = ROOT / "server" / "outgoing-attachment-scan-provenance-store.js"
DELIVERY_TEST = ROOT / "tests" / "attachment-delivery-service.test.js"
PROVENANCE_TEST = ROOT / "tests" / "attachment-scan-provenance-store.test.js"
OUTGOING_TEST = ROOT / "tests" / "gmail-outgoing-attachment-security.test.js"
OUTGOING_PROVENANCE_TEST = ROOT / "tests" / "outgoing-attachment-scan-provenance-store.test.js"
DOC = ROOT / "docs" / "wardveil-attachment-scanning.md"
OUTGOING_DOC = ROOT / "docs" / "outgoing-attachment-wardveil-gate.md"
PLATFORM = ROOT / "docs" / "PLATFORM_CONFORMANCE.md"
README = ROOT / "README.md"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(f"GoreeCloud Mail Wardveil validation failed: {message}")


def main() -> None:
    required_paths = (
        CONTRACT, REFERENCE, CLIENT, DELIVERY, PROVENANCE, OUTGOING_GATE, OUTGOING_PROVENANCE,
        DELIVERY_TEST, PROVENANCE_TEST, OUTGOING_TEST, OUTGOING_PROVENANCE_TEST,
        DOC, OUTGOING_DOC, PLATFORM, README,
    )
    for path in required_paths:
        require(path.is_file(), f"missing required file: {path.relative_to(ROOT)}")

    contract = json.loads(CONTRACT.read_text(encoding="utf-8"))
    reference = REFERENCE.read_text(encoding="utf-8")
    client = CLIENT.read_text(encoding="utf-8")
    delivery = DELIVERY.read_text(encoding="utf-8")
    provenance = PROVENANCE.read_text(encoding="utf-8")
    outgoing_gate = OUTGOING_GATE.read_text(encoding="utf-8")
    outgoing_provenance = OUTGOING_PROVENANCE.read_text(encoding="utf-8")
    delivery_test = DELIVERY_TEST.read_text(encoding="utf-8").lower()
    provenance_test = PROVENANCE_TEST.read_text(encoding="utf-8").lower()
    outgoing_test = OUTGOING_TEST.read_text(encoding="utf-8").lower()
    outgoing_provenance_test = OUTGOING_PROVENANCE_TEST.read_text(encoding="utf-8").lower()
    doc = DOC.read_text(encoding="utf-8").lower()
    outgoing_doc = OUTGOING_DOC.read_text(encoding="utf-8").lower()
    platform = PLATFORM.read_text(encoding="utf-8").lower()
    readme = README.read_text(encoding="utf-8").lower()

    require(contract.get("contract_version") == "0.5.0", "unexpected Mail integration contract version")
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
        "caller_id", "key_id", "timestamp", "nonce", "action", "resource_type",
        "resource_id", "correlation_id", "size_bytes", "digest_sha256",
    }
    require(set(transport.get("signature_binds") or ()) == expected_signed_fields, "Wardveil signature binding set changed")

    enforcement = contract.get("delivery_enforcement") or {}
    for key in (
        "wardveil_scan_client_required", "provider_bytes_scanned_before_downloadable_storage",
        "only_current_clean_result_may_create_downloadable_record", "scanner_unavailable_fails_closed_before_storage",
        "stored_sha256_must_equal_scan_digest", "changed_during_scan_or_storage_fails_closed",
        "download_rechecks_scan_validity", "download_rechecks_stored_digest_binding",
        "process_restart_without_current_scan_provenance_fails_closed",
    ):
        require(enforcement.get(key) is True, f"delivery enforcement missing fail-closed invariant: {key}")
    for key in (
        "malicious_content_stored_for_download", "suspicious_content_stored_for_download",
        "unknown_content_stored_for_download", "unsupported_content_stored_for_download",
    ):
        require(enforcement.get(key) is False, f"delivery enforcement acceptance boundary changed: {key}")
    require(enforcement.get("scan_action") == "download", "Mail delivery scan action must be download")

    durable = contract.get("durable_scan_provenance") or {}
    for key in (
        "implemented", "atomic_write", "size_bounded", "integrity_sha256", "object_id_binding", "clean_only",
        "stores_scan_record_id", "stores_correlation_id", "stores_producer_id", "stores_observed_at",
        "stores_valid_until", "stores_content_digest", "stores_evidence_refs", "restart_rehydration",
        "missing_provenance_fails_closed", "corrupt_or_tampered_provenance_fails_closed",
        "evidence_expiry_enforced_after_restart", "cleanup_coordinated_with_attachment",
    ):
        require(durable.get(key) is True, f"durable scan provenance missing invariant: {key}")
    require(durable.get("scope") == "incoming_download_cache", "incoming provenance scope drifted")
    require(durable.get("storage") == "private_attachment_sidecar_json", "unexpected durable scan provenance storage")
    require(durable.get("schema_version") == 1, "unexpected durable scan provenance schema")
    require(durable.get("file_mode") == "0600", "durable scan provenance must be mode 0600")
    require(durable.get("max_bytes") == 65536, "unexpected durable scan provenance size bound")
    for key in (
        "stores_raw_attachment_content", "stores_provider_credentials", "stores_wardveil_caller_secrets",
        "production_authenticated_provenance_store_accepted", "automatic_rescan_after_restart_implemented",
    ):
        require(durable.get(key) is False, f"durable scan provenance acceptance boundary changed: {key}")

    outgoing = contract.get("outgoing_write_enforcement") or {}
    for key in (
        "implemented", "attachment_writes_require_wardveil_gate", "message_validation_precedes_scan",
        "exact_validated_bytes_scanned", "exact_authorized_bytes_serialized_to_provider_mime",
        "only_current_authoritative_clean_may_reach_provider_write",
        "malicious_suspicious_unknown_unsupported_block_before_provider",
        "scanner_unavailable_blocks_before_provider", "resource_ids_content_bound_and_opaque",
        "resource_ids_exclude_raw_attachment_names_content_and_user_identifiers",
        "provenance_persistence_precedes_provider_client_creation",
        "provenance_persistence_failure_blocks_provider_write", "non_attachment_writes_unchanged",
    ):
        require(outgoing.get(key) is True, f"outgoing enforcement missing invariant: {key}")
    require(set(outgoing.get("actions") or ()) == {"send", "draft"}, "outgoing scan actions must remain send and draft")

    outgoing_durable = contract.get("outgoing_durable_scan_provenance") or {}
    for key in (
        "implemented", "atomic_write", "size_bounded", "integrity_sha256", "operation_id_binding",
        "operation_id_is_opaque_sha256", "clean_only", "stores_action", "stores_scan_record_id",
        "stores_correlation_id", "stores_producer_id", "stores_observed_at", "stores_valid_until",
        "stores_content_digest", "stores_opaque_resource_id", "stores_evidence_refs",
        "persistence_failure_fails_closed_before_provider",
    ):
        require(outgoing_durable.get(key) is True, f"outgoing durable provenance missing invariant: {key}")
    require(outgoing_durable.get("storage") == "private_operation_sidecar_json", "unexpected outgoing provenance storage")
    require(outgoing_durable.get("schema_version") == 1, "unexpected outgoing provenance schema")
    require(outgoing_durable.get("file_mode") == "0600", "outgoing provenance must be mode 0600")
    require(outgoing_durable.get("max_bytes") == 131072, "unexpected outgoing provenance size bound")
    for key in (
        "operation_id_exposes_raw_account_or_user_identifier", "stores_attachment_filename",
        "stores_raw_attachment_content", "stores_recipient_address", "stores_provider_credentials",
        "stores_wardveil_caller_secrets", "application_provenance_is_wardveil_audit",
        "integrity_sha256_is_production_security_signature", "production_authenticated_provenance_store_accepted",
    ):
        require(outgoing_durable.get(key) is False, f"outgoing provenance acceptance/minimization boundary changed: {key}")

    mapping = contract.get("result_mapping") or {}
    require(mapping.get("clean") == "allow_only_when_all_validation_passes", "clean mapping is not fail closed")
    require(mapping.get("suspicious") == "hold_for_review_without_downloadable_cache_or_provider_write", "suspicious mapping must fail closed")
    require(mapping.get("malicious") == "block_and_request_quarantine_without_downloadable_cache_or_provider_write", "malicious mapping must fail closed")
    require(mapping.get("unknown") == "block_unverified_without_downloadable_cache_or_provider_write", "unknown result must fail closed")
    require(mapping.get("unsupported") == "block_unverified_without_downloadable_cache_or_provider_write", "unsupported result must fail closed")

    quarantine = contract.get("quarantine") or {}
    require(quarantine.get("requires_explicit_executor_authority") is True, "quarantine must require explicit authority")
    require(quarantine.get("is_deletion") is False, "quarantine must not equal deletion")
    require(quarantine.get("mail_consumer_executes_quarantine_directly") is False, "Mail consumer must not execute quarantine directly")

    privacy = contract.get("privacy") or {}
    require(privacy.get("raw_attachment_content_in_shared_security_records") is False, "raw attachment content must not enter shared security records")
    require(privacy.get("credentials_or_provider_tokens_in_security_records") is False, "provider credentials must not enter security records")
    require(privacy.get("data_minimization_required") is True, "Mail security evidence must remain minimized")

    for token in (
        'EXPECTED_RESOURCE_TYPE = "mail_attachment"', 'sha256(content).hexdigest()', 'record.get("result")',
        '"obsolete_scan_result_field"', '"content_digest_mismatch"', '"non_authoritative_scan_record"',
        '"clean_scan_evidence_expired"', '"wardveil_scan_malicious"', '"requires_explicit_executor_authority": True',
        '"destructive_action": False',
    ):
        require(token in reference, f"reference implementation missing invariant: {token}")

    for token in (
        "WARDVEIL_SCAN_CONTRACT_VERSION = '0.1.0'", "MAIL_ATTACHMENT_RESOURCE_TYPE = 'mail_attachment'",
        "endpoint.protocol !== 'http:'", "endpoint.hostname !== '127.0.0.1'", "redirect: 'manual'",
        "'x-wardveil-caller-id'", "'x-wardveil-key-id'", "'x-wardveil-timestamp'", "'x-wardveil-nonce'",
        "'x-wardveil-digest-sha256'", "'x-wardveil-correlation-id'", "'x-wardveil-signature'",
        "Object.hasOwn(record, 'scan_result')", "record.result", "response correlation mismatch", "response resource binding mismatch",
    ):
        require(token in client, f"Mail Wardveil transport missing invariant: {token}")

    for token in (
        "wardveilScanClient with scanAttachment is required", "await this.wardveilScanClient.scanAttachment", "action: 'download'",
        "requireCurrentCleanScan", "stored.sha256 !== expectedDigest", "stored.sha256 !== scan.digestSha256",
        "persistWardveilScanProvenance", "readWardveilScanProvenance", "removeWardveilScanProvenance",
        "this.#loadDurableScanProvenance", "requirePersistedCleanScan", "this.scanProvenance.delete(record.objectId)",
        "quarantineRequired", "Object.hasOwn(record, 'scan_result')",
    ):
        require(token in delivery, f"attachment delivery missing Wardveil enforcement invariant: {token}")

    for token in (
        "const PROVENANCE_SCHEMA_VERSION = 1", "const MAX_PROVENANCE_BYTES = 64 * 1024", "timingSafeEqual",
        "'wx', 0o600", "integrity_sha256", "Only current clean Wardveil scan provenance may be persisted",
        "wardveil-scan-provenance-missing", "removeWardveilScanProvenance",
    ):
        require(token in provenance, f"durable scan provenance store missing invariant: {token}")

    for token in (
        "persistOutgoingWardveilScanProvenance", "provenanceRootDir is required", "buildGmailRawMessage(message)",
        "await this.wardveilScanClient.scan", "action !== 'send' && action !== 'draft'", "outgoingResourceId",
        "outgoingProvenanceOperationId", "outgoing_wardveil_scan_provenance_persistence_failed",
        "persisted.operationId !== operationId", "bytes: Buffer.from(bytes)",
    ):
        require(token in outgoing_gate, f"outgoing Wardveil gate missing invariant: {token}")

    for token in (
        "const PROVENANCE_SCHEMA_VERSION = 1", "const MAX_PROVENANCE_BYTES = 128 * 1024",
        "const RESOURCE_ID_RE = /^mail:outgoing:[0-9a-f]{64}$/", "timingSafeEqual", "'wx', 0o600",
        "integrity_sha256", "Only current clean outgoing Wardveil scan provenance may be persisted",
        "outgoing-wardveil-scan-provenance-missing", "operation binding mismatch",
    ):
        require(token in outgoing_provenance, f"outgoing provenance store missing invariant: {token}")

    for phrase in (
        "malicious wardveil result blocks storage", "suspicious, unknown, and unsupported wardveil results never create downloadable cache objects",
        "scanner transport failure fails closed before storage", "expired clean wardveil evidence fails closed before storage",
        "scan digest mismatch fails closed before storage", "content changed between scan and storage is rolled back",
        "clean evidence expiry blocks a previously stored attachment", "durable wardveil scan provenance survives service recreation",
        "missing durable scan provenance after restart fails closed", "tampered durable scan provenance after restart fails closed",
    ):
        require(phrase in delivery_test, f"attachment-delivery tests missing case: {phrase}")

    for phrase in (
        "round trips with restrictive file mode", "contains minimized security metadata rather than raw attachment content or secrets",
        "rejects non-clean state", "tampering fails integrity verification", "missing provenance is distinguishable",
    ):
        require(phrase in provenance_test, f"scan-provenance tests missing case: {phrase}")

    for phrase in (
        "durably records clean provenance", "persistence failure blocks before gmail client creation",
        "persists clean provenance before send and serializes only authorized attachment bytes",
    ):
        require(phrase in outgoing_test, f"outgoing attachment tests missing case: {phrase}")

    for phrase in (
        "round trips with restrictive file mode",
        "contains minimized security metadata rather than attachment content, names, account ids, or secrets",
        "rejects non-clean state", "tampering fails integrity verification", "missing outgoing provenance is distinguishable",
    ):
        require(phrase in outgoing_provenance_test, f"outgoing provenance tests missing case: {phrase}")

    for phrase in (
        "mail does not connect directly to clamav", "quarantine is not deletion", "unknown and unsupported results fail closed",
        "production runtime status remains `unaccepted`", "privacy shield boundary", "everkeep integration",
        "hardened wardveil scan transport", "scan_record.result", "attachment-delivery enforcement", "durable scan provenance",
    ):
        require(phrase in doc, f"integration documentation missing boundary: {phrase}")

    for phrase in (
        "durable outgoing scan provenance", "before gmail client creation", "does not store attachment filenames",
        "not wardveil audit", "production authenticated provenance-store acceptance",
    ):
        require(phrase in outgoing_doc, f"outgoing integration documentation missing boundary: {phrase}")

    for phrase in ("wardveil security", "privacy shield", "everkeep", "glaze ui"):
        require(phrase in platform, f"platform conformance missing mandatory system: {phrase}")

    require("wardveil attachment scanning" in readme, "README must expose Wardveil attachment integration")
    require("production deployment is not approved" in readme, "README must preserve production gate")

    print("GoreeCloud Mail Wardveil bidirectional durable attachment security integration validation passed.")


if __name__ == "__main__":
    main()
