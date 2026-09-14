#!/usr/bin/env python3
"""Fail-closed validation for GoreeCloud Mail Android GLAZE UI V1.4 adoption."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
THEME = ROOT / "clients/android/app/src/main/java/com/goreecloud/mail/GlazeMailTheme.kt"
MAIN = ROOT / "clients/android/app/src/main/java/com/goreecloud/mail/MainActivity.kt"
MANIFEST = ROOT / "clients/android/app/src/main/AndroidManifest.xml"
DOC = ROOT / "docs/glaze-ui-v1.4-android-adoption.md"
READ_CONTRACT = ROOT / "clients/android/app/src/main/java/com/goreecloud/mail/MailProviderReadContract.kt"
RESPONSE_CONTRACT = ROOT / "clients/android/app/src/main/java/com/goreecloud/mail/MailProviderResponseContract.kt"
CAPABILITIES = ROOT / "clients/android/app/src/main/java/com/goreecloud/mail/MailCapabilitySnapshot.kt"

VERSION = "1.4.0"
REVISION = "84cb3db4884042f0fa25ed6d475a127fb110f596"


def require(text: str, fragment: str, label: str) -> None:
    if fragment not in text:
        raise SystemExit(f"{label}: required fragment missing: {fragment!r}")


def forbid(text: str, fragment: str, label: str) -> None:
    if fragment in text:
        raise SystemExit(f"{label}: forbidden fragment present: {fragment!r}")


def main() -> None:
    theme = THEME.read_text(encoding="utf-8")
    main_source = MAIN.read_text(encoding="utf-8")
    manifest = MANIFEST.read_text(encoding="utf-8")
    doc = DOC.read_text(encoding="utf-8")
    read_contract = READ_CONTRACT.read_text(encoding="utf-8")
    response_contract = RESPONSE_CONTRACT.read_text(encoding="utf-8")
    capabilities = CAPABILITIES.read_text(encoding="utf-8")

    require(theme, f'VERSION = "{VERSION}"', "theme")
    require(theme, f'REFERENCE_REVISION = "{REVISION}"', "theme")
    require(theme, 'ADOPTION_STATE = "ADOPTION_IN_PROGRESS"', "theme")
    for flag in (
        "OPTICAL_ENGINE_ACCEPTED",
        "REDUCED_TRANSPARENCY_ACCEPTED",
        "INCREASED_CONTRAST_ACCEPTED",
        "PHYSICAL_DEVICE_ACCEPTED",
        "HUMAN_VISUAL_ACCEPTED",
    ):
        require(theme, f"{flag} = false", "theme")

    require(main_source, "GlazeMailTheme", "MainActivity")
    require(main_source, "Provider read contract", "MainActivity")
    require(doc, "Development / adoption in progress", "documentation")
    require(doc, REVISION, "documentation")

    require(read_contract, 'ACCOUNTS_PATH = "/api/mail/accounts"', "provider read contract")
    require(read_contract, "fun accountPath(accountId: String)", "provider read contract")
    require(read_contract, "fun capabilitiesPath(accountId: String)", "provider read contract")
    require(read_contract, "value == value.trim()", "provider read contract")
    require(read_contract, "value.none(Char::isISOControl)", "provider read contract")
    require(read_contract, "networkTransport = MailProviderReadContractState.TRANSPORT_BLOCKED", "provider read contract")

    require(response_contract, '"externalAccountId"', "provider response contract")
    require(response_contract, '"createdAt"', "provider response contract")
    require(response_contract, '"mailboxAccess"', "provider response contract")
    require(response_contract, '"organizationPolicies"', "provider response contract")
    require(response_contract, "envelope.capabilities.keys != KNOWN_CAPABILITIES", "provider response contract")
    require(response_contract, "envelope.account.id != expectedAccountId", "provider response contract")
    forbid(response_contract, '"userId",', "provider response contract")
    forbid(response_contract, '"accessToken",', "provider response contract")
    forbid(response_contract, '"refreshToken",', "provider response contract")
    forbid(response_contract, '"password",', "provider response contract")

    require(capabilities, "val providerReadContract: MailCapability", "capability snapshot")
    require(capabilities, "providerReadContract = MailCapability(", "capability snapshot")
    require(capabilities, "state = MailCapabilityState.SOURCE_READY", "capability snapshot")

    # Source-ready contracts must not accidentally expand Mail's runtime authority.
    forbid(manifest, "android.permission.INTERNET", "manifest")
    require(manifest, 'android:allowBackup="false"', "manifest")

    print(
        "Mail Android boundary validated: "
        f"glaze={VERSION}@{REVISION} providerReadContract=source-ready "
        "internet=false identityRuntime=false providerTransport=false production=false"
    )


if __name__ == "__main__":
    main()
