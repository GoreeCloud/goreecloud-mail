# GoreeCloud Mail Android Client

This directory contains the first-party native Android application line for GoreeCloud Mail.

## Current Development foundation

The Android client includes a Kotlin/Jetpack Compose `:app` module targeting SDK 36 with minimum SDK 29 and Java 17. The current shell provides a launchable mailbox interface and a truthful runtime-capability model, but it deliberately remains disconnected from production mail services.

Current implemented foundation:

- Native Android application module and launcher activity.
- Compose-based Development mailbox surface.
- Repository-local GLAZE UI V1.4 / `1.4.0` source-adoption boundary pinned to exact Stable revision `84cb3db4884042f0fa25ed6d475a127fb110f596`.
- Explicit capability state for account transport, background synchronization, push notifications, secure local storage, and attachment handling.
- Source-ready `MailSessionBinding` prerequisite for non-secret principal, exact opaque Mail account, Android-Mail audience, and lifetime proof metadata.
- Source-ready transport-neutral provider-account contract for the trusted account list/detail/capability GET boundaries.
- Source-ready exact-field in-memory decoder for provider-account responses. It rejects missing/unknown fields and type coercion before semantic acceptance and intentionally adds no JSON or network library.
- Exact opaque account IDs are preserved and encoded only as path segments; account responses accept only public account metadata and exclude owning user IDs and reusable credentials.
- Capability responses require the complete canonical Courier/Mail capability vocabulary and exact account/provider binding before native acceptance.
- Fail-closed Development behavior: no `INTERNET` permission and no provider/account transport authority is claimed.
- Android backup disabled for the current shell.
- JVM coverage for capability truthfulness, session binding, account path/shape rules, decoder field/type rejection, account/provider mismatch, and capability-vocabulary drift.
- Android Client CI validates the V1.4/source authority boundary, JVM tests, and debug APK assembly.

The session-binding, provider-account, and decoder contracts are prerequisites, not authentication or transport implementations. They do not create or persist credentials, register Mail with GoreeCloud Identity, exchange bearer/refresh tokens, copy browser cookies, enable network transport, authorize provider access, or access mailbox content. External-provider authorization remains a separate authority from GoreeCloud Identity.

The trusted backend remains responsible for deriving the GoreeCloud user from authenticated session state, enforcing account ownership, resolving provider type, holding reusable provider credentials, and invoking provider implementations. Android source must not accept client-selected owner identity as authority.

## Platform-system boundary

The Android Development line is evaluated independently against Manager, Privacy Shield, Wardveil Security, Everkeep, GLAZE UI, Mesh, Identity, and Sync. Current source/build evidence does not establish accepted runtime integration for Manager, Privacy Shield, Wardveil Security, Everkeep, Mesh, Identity, or Sync. GLAZE UI V1.4 source adoption remains `ADOPTION_IN_PROGRESS`; rendered/accessibility/device acceptance and applicable V1.4.1 manual qualification remain separate.

GoreeCloud Sync must not be inferred from provider synchronization, local cache/storage, background work, offline replay, or Everkeep backup/recovery.

## Next Android work

1. Define and accept first-party GoreeCloud Identity native application registration and credential/session exchange for Android Mail without reusable application-wide credentials.
2. Only after accepted Identity/runtime authority, add a bounded authenticated same-service transport adapter for read-only provider-account discovery against non-production Development data.
3. Define mailbox/message request, exact-field decode, and response acceptance contracts before enabling mailbox retrieval.
4. Add protected local message/index storage with explicit data-minimization, encryption/key-custody, eviction, and recovery behavior.
5. Add bounded background work and push-notification authority.
6. Add attachment download/open/share behavior under accepted Wardveil Security and Privacy Shield policy.
7. Add offline queueing, version/conflict handling, and explicit GoreeCloud Sync integration where applicable.
8. Complete repository-wide GLAZE UI V1.4 migration, Android rendered/accessibility/form-factor/representative-device acceptance, and applicable V1.4.1 human/manual checks.
9. Complete Everkeep backup/restore behavior for Mail-owned Android state where applicable.
10. Add APK/AAB provenance/SBOM, protected signing, rollback/upgrade evidence, Release Candidate, production, and Stable gates.

Signing material, reusable secrets, provider credentials, and production Identity credentials must remain outside GitHub and outside source-controlled application configuration.
