#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "contracts" / "wardveil.mail-attachment-scan.json"
HARNESS = ROOT / "server" / "mail-wardveil-runtime-acceptance.js"
COMMAND = ROOT / "scripts" / "run-mail-wardveil-runtime-acceptance.mjs"
TEST = ROOT / "tests" / "mail-wardveil-runtime-acceptance.test.js"
DOC = ROOT / "docs" / "mail-wardveil-runtime-acceptance.md"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(f"GoreeCloud Mail Wardveil runtime tooling validation failed: {message}")


def main() -> None:
    for path in (CONTRACT, HARNESS, COMMAND, TEST, DOC):
        require(path.is_file(), f"missing required file: {path.relative_to(ROOT)}")

    contract = json.loads(CONTRACT.read_text(encoding="utf-8"))
    harness = HARNESS.read_text(encoding="utf-8")
    command = COMMAND.read_text(encoding="utf-8")
    test = TEST.read_text(encoding="utf-8")
    doc = DOC.read_text(encoding="utf-8").lower()

    require(contract.get("contract_version") == "0.5.0", "Mail Wardveil contract version drifted")
    require(contract.get("production_runtime_status") == "unaccepted", "tooling must not grant production acceptance")

    tooling = contract.get("runtime_acceptance_tooling") or {}
    for key in (
        "implemented",
        "exact_mail_revision_required",
        "exact_wardveil_revision_required",
        "live_wardveil_scan_required",
        "incoming_download_clean_control",
        "incoming_download_eicar_control",
        "outgoing_send_clean_control",
        "outgoing_send_eicar_control",
        "outgoing_draft_clean_control",
        "outgoing_draft_eicar_control",
        "uses_real_mail_application_services",
        "caller_secret_regular_non_symlink_required",
        "caller_secret_root_owned_required",
        "sanitized_evidence_excludes_raw_attachment_content",
        "sanitized_evidence_excludes_provider_credentials",
        "sanitized_evidence_excludes_wardveil_caller_secret",
    ):
        require(tooling.get(key) is True, f"runtime tooling invariant missing: {key}")
    require(tooling.get("command") == "scripts/run-mail-wardveil-runtime-acceptance.mjs", "unexpected runtime command")
    require(tooling.get("provider_boundary") == "controlled_non_network_provider", "runtime provider boundary drifted")
    require(tooling.get("real_gmail_provider_execution_accepted") is False, "real Gmail acceptance must remain separate")
    require(tooling.get("successful_tool_run_grants_overall_production_acceptance") is False, "tool success must not grant overall production acceptance")
    require(tooling.get("target_environment_execution_status") == "pending", "source tooling must remain pending until target execution evidence exists")
    require(set(tooling.get("caller_secret_allowed_modes") or ()) == {"0400", "0600"}, "secret mode boundary drifted")

    for token in (
        "AttachmentDeliveryService",
        "GmailAccountService",
        "GmailOutgoingAttachmentSecurityGate",
        "wardveilScanProvenancePath",
        "readOutgoingWardveilScanProvenance",
        "incoming_clean_download",
        "incoming_eicar_blocked",
        "outgoing_send_clean_admitted",
        "outgoing_send_eicar_blocked",
        "outgoing_draft_clean_admitted",
        "outgoing_draft_eicar_blocked",
        "controlled_provider_boundary: 'passed'",
        "real_gmail_provider_execution: 'not_proven'",
        "production_runtime_acceptance: 'unaccepted'",
        "protection_claim_authority: false",
        "raw_attachment_content_in_evidence: false",
        "provider_credentials_in_evidence: false",
        "wardveil_caller_secret_in_evidence: false",
    ):
        require(token in harness, f"runtime harness missing invariant: {token}")

    for token in (
        "lstat",
        "info.isSymbolicLink()",
        "info.uid !== 0",
        "mode !== 0o400 && mode !== 0o600",
        "open(resolved, 'wx', 0o600)",
        "--mail-revision",
        "--wardveil-revision",
        "--secret-file",
        "runtime_application_consumer_matrix=passed",
        "real_gmail_provider_execution=not_proven",
        "production_runtime_acceptance=unaccepted",
    ):
        require(token in command, f"runtime command missing invariant: {token}")

    for token in (
        "runtime_application_consumer_matrix",
        "incoming_clean_download",
        "incoming_eicar_blocked",
        "send_blocked_before_provider_client",
        "draft_blocked_before_provider_client",
        "real_gmail_provider_execution",
        "production_runtime_acceptance",
        "['download', 'download', 'send', 'draft', 'send', 'draft']",
    ):
        require(token in test, f"runtime tooling regression test missing invariant: {token}")

    for phrase in (
        "controlled provider boundary",
        "real gmail provider execution remains unproven",
        "production runtime acceptance remains unaccepted",
        "no broad protected by wardveil claim",
        "caller secret",
        "incoming clean",
        "incoming eicar",
        "outgoing send",
        "outgoing draft",
    ):
        require(phrase in doc, f"runtime acceptance documentation missing boundary: {phrase}")

    print("GoreeCloud Mail Wardveil runtime acceptance tooling validation passed.")


if __name__ == "__main__":
    main()
