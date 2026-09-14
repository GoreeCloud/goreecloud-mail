#!/usr/bin/env python3
"""Fail-closed validation for GoreeCloud Mail Android GLAZE UI V1.4 adoption."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
THEME = ROOT / "clients/android/app/src/main/java/com/goreecloud/mail/GlazeMailTheme.kt"
MAIN = ROOT / "clients/android/app/src/main/java/com/goreecloud/mail/MainActivity.kt"
MANIFEST = ROOT / "clients/android/app/src/main/AndroidManifest.xml"
DOC = ROOT / "docs/glaze-ui-v1.4-android-adoption.md"
CAPABILITIES = ROOT / "clients/android/app/src/main/java/com/goreecloud/mail/MailCapabilitySnapshot.kt"
PROVIDER_ACCOUNT = ROOT / "clients/android/app/src/main/java/com/goreecloud/mail/MailProviderAccountContract.kt"

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
    capabilities = CAPABILITIES.read_text(encoding="utf-8")
    provider_account = PROVIDER_ACCOUNT.read_text(encoding="utf-8")

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
    require(doc, "Development / adoption in progress", "documentation")
    require(doc, REVISION, "documentation")

    require(provider_account, 'ACCOUNTS_PATH = "/api/mail/accounts"', "provider account contract")
    require(provider_account, '"mailboxAccess"', "provider account contract")
    require(provider_account, '"messageRead"', "provider account contract")
    require(provider_account, '"organizationPolicies"', "provider account contract")
    require(provider_account, 'account.id != expected', "provider account contract")
    require(provider_account, 'response.capabilities.keys != KNOWN_CAPABILITIES', "provider account contract")
    forbid(provider_account, "fetch(", "provider account contract")
    forbid(provider_account, "HttpClient", "provider account contract")
    forbid(provider_account, "Bearer", "provider account contract")
    forbid(provider_account, "refreshToken", "provider account contract")

    require(capabilities, "providerAccountReadContract", "capability snapshot")
    require(capabilities, "providerCapabilityReadContract", "capability snapshot")
    require(capabilities, "mailboxReadContract", "capability snapshot")
    require(capabilities, "messageReadContract", "capability snapshot")
    require(capabilities, "MailCapabilityState.BACKEND_BLOCKED", "capability snapshot")

    # This Glaze/source-contract migration must not accidentally expand Mail's runtime authority.
    forbid(manifest, "android.permission.INTERNET", "manifest")
    require(manifest, 'android:allowBackup="false"', "manifest")

    print(
        "Mail Android V1.4/source boundary validated: "
        f"version={VERSION} revision={REVISION} "
        "providerAccountRead=source-ready providerCapabilities=source-ready "
        "mailboxRead=backend-blocked messageRead=backend-blocked internet=false production=false"
    )


if __name__ == "__main__":
    main()
