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
- Source-ready transport-neutral provider-account contract for the existing trusted `GET /api/mail/accounts`, `GET /api/mail/accounts/{accountId}`, and `GET /api/mail/accounts/{accountId}/capabilities` boundaries.
- Exact opaque account IDs are preserved and encoded only as path segments; account responses accept only public account metadata and exclude owning user IDs and reusable credentials.
- Capability responses require the complete canonical Courier/Mail capability vocabulary and exact account/provider binding before they are accepted by native source policy.
- Fail-closed Development behavior: no `INTERNET` permission and no provider/account transport authority is claimed.
- Android backup disabled for the current shell.
- JVM coverage for capability truthfulness, session-binding rules, account-path construction, public response shape, account/provider mismatch, and capability-vocabulary drift.
- Android Client CI validating the V1.4/source authority boundary, JVM tests, and debug APK assembly.
- Gradle caching, parallel execution, and incremental Kotlin compilation enabled.

The session-binding and provider-account contracts are prerequisites, not authentication or transport implementations. They do not create or persist credentials, register Mail with GoreeCloud Identity, exchange bearer/refresh tokens, copy browser cookies, enable network transport, authorize provider access, or access mailbox content. External-provider authorization remains a separate authority from GoreeCloud Identity.

The trusted backend remains responsible for deriving the GoreeCloud user from authenticated session state, enforcing account ownership, resolving provider type, holding reusable provider credentials, and invoking provider implementations. Android source must not accept browser- or client-selected owner identity as authority.

## Platform-system boundary

The Android Development line is evaluated independently against all eight GoreeCloud Platform Systems: Manager, Privacy Shield, Wardveil Security, Everkeep, GLAZE UI, Mesh, Identity, and Sync.

Current source/build evidence does not establish accepted runtime integration for Manager, Privacy Shield, Wardveil Security, Everkeep, Mesh, Identity, or Sync. GLAZE UI V1.4 source adoption remains `ADOPTION_IN_PROGRESS`; application-level rendered/accessibility/device acceptance and applicable V1.4.1 manual qualification remain separate.

GoreeCloud Sync must not be inferred from provider synchronization, local cache/storage, background work, offline replay, or Everkeep backup/recovery.

## Next Android work

Advance each capability independently and preserve truthful authority boundaries:

1. Add an exact-field decoder for the already source-ready provider-account/list/detail/capability response contract; keep transport disabled.
2. Define and accept first-party GoreeCloud Identity native application registration and credential/session exchange for Android Mail without reusable application-wide credentials.
3. Only after accepted Identity/runtime authority, add a bounded authenticated same-service transport adapter for read-only provider-account discovery against non-production Development data.
4. Define mailbox/message request and response contracts before enabling read-only mailbox retrieval.
5. Add protected local message/index storage with explicit data-minimization, encryption/key-custody, eviction, and recovery behavior.
6. Add bounded background work and push-notification authority.
7. Add attachment download/open/share behavior under accepted Wardveil Security and Privacy Shield policy.
8. Add offline queueing, version/conflict handling, and explicit GoreeCloud Sync integration where applicable.
9. Complete repository-wide GLAZE UI V1.4 migration, Android rendered/accessibility/form-factor/representative-device acceptance, and applicable V1.4.1 human/manual checks.
10. Complete Everkeep backup/restore behavior for Mail-owned Android state where applicable.
11. Add APK/AAB provenance/SBOM, protected signing, rollback/upgrade evidence, Release Candidate, production, and Stable gates.

Signing material, reusable secrets, provider credentials, and production Identity credentials must remain outside GitHub and outside source-controlled application configuration.
