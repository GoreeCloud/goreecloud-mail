#!/usr/bin/env python3
"""Fail-closed validation for GoreeCloud Mail Android GLAZE UI V1.4 adoption."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
THEME = ROOT / "clients/android/app/src/main/java/com/goreecloud/mail/GlazeMailTheme.kt"
MAIN = ROOT / "clients/android/app/src/main/java/com/goreecloud/mail/MainActivity.kt"
MANIFEST = ROOT / "clients/android/app/src/main/AndroidManifest.xml"
DOC = ROOT / "docs/glaze-ui-v1.4-android-adoption.md"

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

    # This Glaze migration must not accidentally expand Mail's runtime authority.
    forbid(manifest, "android.permission.INTERNET", "manifest")
    require(manifest, 'android:allowBackup="false"', "manifest")

    print(
        "Mail Android GLAZE UI V1.4 adoption validated: "
        f"version={VERSION} revision={REVISION} conformance=false production=false"
    )


if __name__ == "__main__":
    main()
