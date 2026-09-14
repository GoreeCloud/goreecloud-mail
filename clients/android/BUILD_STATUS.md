# GoreeCloud Mail — Android Build Status

Target artifacts:

- APK
- Android App Bundle

Current Development state:

- Native Android application module established under `clients/android/app`.
- Development shell uses Kotlin, Jetpack Compose, SDK 36, minimum SDK 29, and Java 17.
- Launcher activity and disconnected mailbox surface are implemented.
- Repository-local GLAZE UI V1.4 / `1.4.0` source mapping is pinned to exact Stable revision `84cb3db4884042f0fa25ed6d475a127fb110f596` and remains application-level `ADOPTION_IN_PROGRESS`.
- Source-ready `MailSessionBinding` validates non-secret principal/account/audience/lifetime proof metadata while granting no authentication or transport authority.
- Source-ready Android provider-read contracts cover only the exact server-supported account discovery/detail/capability GET routes and their public response shapes.
- Provider account identity remains opaque; response acceptance rejects account/request drift, duplicate account IDs, malformed records, and capability-set drift.
- Runtime capability state remains explicit for account transport, background sync, push notifications, secure local storage, and attachment handling.
- All live network/data capabilities remain fail-closed and unavailable; the manifest intentionally declares no `INTERNET` permission.
- Android backup is disabled for the Development shell.
- Android Client CI validates the V1.4/source-authority boundary, JVM tests, and debug APK assembly.
- JSON/network decoding, authenticated account transport, mailbox/message reads, instrumentation/device acceptance, secure credential persistence, protected local mail storage, GoreeCloud Sync runtime, attachment runtime, SBOM/provenance, protected signing, Android App Bundle release construction, representative-device acceptance, and release acceptance remain pending.
- Signing keys, reusable credentials, and provider/Identity secrets must remain outside GitHub.

A successful debug build is Development build evidence only. It is not authenticated provider access, Release Candidate, production, Platform-System acceptance, or Stable qualification.
