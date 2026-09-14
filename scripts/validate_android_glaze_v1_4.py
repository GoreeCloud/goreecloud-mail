#!/usr/bin/env python3
"""Fail-closed validation for GoreeCloud Mail Android GLAZE UI V1.4 adoption."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
THEME = ROOT / "clients/android/app/src/main/java/com/goreecloud/mail/GlazeMailTheme.kt"
MAIN = ROOT / "clients/android/app/src/main/java/com/goreecloud/mail/MainActivity.kt"
MANIFEST = ROOT / "clients/android/app/src/main/AndroidManifest.xml"
DOC = ROOT / "docs/glaze-ui-v1.4-android-adoption.md"
PROVIDER_CONTRACT = ROOT / "clients/android/app/src/main/java/com/goreecloud/mail/MailProviderAccountContract.kt"
PROVIDER_DECODER = ROOT / "clients/android/app/src/main/java/com/goreecloud/mail/MailProviderAccountDecoder.kt"
IDENTITY_REGISTRATION = ROOT / "clients/android/app/src/main/java/com/goreecloud/mail/MailIdentityRegistration.kt"

VERSION = "1.4.0"
REVISION = "84cb3db4884042f0fa25ed6d475a127fb110f596"
IDENTITY_REGISTRATION_SCHEMA = "goreecloud.identity.native-application-registration/v1"
IDENTITY_REGISTRATION_REVISION = "73c3c00ff44906849baa711c588a0466e72999d7"


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
    provider_contract = PROVIDER_CONTRACT.read_text(encoding="utf-8")
    provider_decoder = PROVIDER_DECODER.read_text(encoding="utf-8")
    identity_registration = IDENTITY_REGISTRATION.read_text(encoding="utf-8")

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

    require(provider_contract, 'ACCOUNTS_PATH = "/api/mail/accounts"', "provider account contract")
    require(provider_contract, "MailProviderAccountContractState.SOURCE_READY", "provider account contract")
    require(provider_contract, "MailProviderAccountContractState.IDENTITY_BLOCKED", "provider account contract")
    require(provider_contract, "MailProviderAccountContractState.TRANSPORT_BLOCKED", "provider account contract")
    require(provider_decoder, "object MailProviderAccountDecoder", "provider account decoder")
    require(provider_decoder, "exactFields", "provider account decoder")
    require(provider_decoder, "MailProviderAccountContract.CAPABILITY_NAMES", "provider account decoder")

    require(identity_registration, f'SCHEMA = "{IDENTITY_REGISTRATION_SCHEMA}"', "Identity registration")
    require(identity_registration, f'CANDIDATE_REVISION = "{IDENTITY_REGISTRATION_REVISION}"', "Identity registration")
    require(identity_registration, "PINNED_REGISTRY_HAS_RUNTIME_REGISTRATIONS = false", "Identity registration")
    require(identity_registration, "MailIdentityRegistrationContractState.SOURCE_READY", "Identity registration")
    require(identity_registration, "MailIdentityRegistrationContractState.PINNED_IDENTITY_REGISTRY_EMPTY", "Identity registration")
    require(identity_registration, "MailIdentityRegistrationContractState.RUNTIME_BLOCKED", "Identity registration")
    require(identity_registration, "object MailIdentityRegistrationDecoder", "Identity registration")
    require(identity_registration, "object MailIdentityRegistrationPolicy", "Identity registration")

    for source, label in (
        (provider_contract, "provider account contract"),
        (provider_decoder, "provider account decoder"),
        (identity_registration, "Identity registration"),
    ):
        forbid(source, "HttpURLConnection", label)
        forbid(source, "OkHttp", label)
        forbid(source, "Retrofit", label)
        forbid(source, "Bearer ", label)
        forbid(source, "org.json", label)
        forbid(source, "kotlinx.serialization", label)
        forbid(source, "Gson", label)

    # These source-ready tranches must not accidentally expand Mail's runtime authority.
    forbid(manifest, "android.permission.INTERNET", "manifest")
    require(manifest, 'android:allowBackup="false"', "manifest")

    print(
        "Mail Android source boundary validated: "
        f"glaze={VERSION}@{REVISION} providerAccountContract=source-ready "
        "providerAccountDecoder=source-ready identityRegistration=source-ready "
        "identityRegistry=empty identityRuntime=false internet=false accountTransport=false "
        "production=false"
    )


if __name__ == "__main__":
    main()
