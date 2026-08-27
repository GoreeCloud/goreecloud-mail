#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "contracts" / "glaze.mail-attachment-security-presentation.json"
EXPECTED_STATES = {
    "scan-clear": (True, True),
    "held-for-review": (False, False),
    "blocked-by-security": (False, False),
    "verification-unavailable": (False, False),
}
EXPECTED_RULES = {
    "absoluteSafetyClaimsAllowed": False,
    "clearRequiresCurrentCleanEvidence": True,
    "clearRequiresEvidenceReferences": True,
    "unknownOrInvalidEvidenceFailsClosed": True,
    "maliciousEvidenceNeverPresentsAsClear": True,
}


def main() -> None:
    data = json.loads(CONTRACT.read_text(encoding="utf-8"))
    expected_top = {"schema", "application", "securityAuthority", "states", "rules", "productionUiAccepted"}
    if set(data) != expected_top:
        raise SystemExit("Glaze attachment security contract keys drifted from reviewed schema")
    if data["schema"] != "glaze.mail-attachment-security-presentation/v1":
        raise SystemExit("unsupported Glaze Mail attachment security schema")
    if data["application"] != "GoreeCloud Mail" or data["securityAuthority"] != "Wardveil Security":
        raise SystemExit("unexpected application or security authority")
    if data["productionUiAccepted"] is not False:
        raise SystemExit("production UI acceptance must remain false until exact-build acceptance")

    states = data["states"]
    if not isinstance(states, dict) or set(states) != set(EXPECTED_STATES):
        raise SystemExit("presentation states must match the reviewed state set exactly")
    for state, (can_open, can_download) in EXPECTED_STATES.items():
        value = states[state]
        if not isinstance(value, dict) or set(value) != {"canOpen", "canDownload", "headline", "detail"}:
            raise SystemExit(f"{state} shape drifted")
        if value["canOpen"] is not can_open or value["canDownload"] is not can_download:
            raise SystemExit(f"{state} action permissions drifted")
        if not isinstance(value["headline"], str) or not value["headline"].strip():
            raise SystemExit(f"{state} headline must be non-empty")
        if not isinstance(value["detail"], str) or not value["detail"].strip():
            raise SystemExit(f"{state} detail must be non-empty")
        if "safe" in value["headline"].lower() or "safe" in value["detail"].lower():
            raise SystemExit(f"{state} must not make an absolute safety claim")

    if data["rules"] != EXPECTED_RULES:
        raise SystemExit("Glaze attachment security rules drifted from fail-closed contract")

    print("Glaze Mail attachment security presentation contract validated")


if __name__ == "__main__":
    main()
