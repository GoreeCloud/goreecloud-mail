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
- Source-ready read-only provider request contract for the server routes that actually exist today: `GET /api/mail/accounts`, `GET /api/mail/accounts/{accountId}`, and `GET /api/mail/accounts/{accountId}/capabilities`.
- Source-ready provider response acceptance for the current public account record (`id`, `provider`, `externalAccountId`, `displayName`, `createdAt`) and the exact normalized Mail capability map.
- Source-ready `MailProviderWireDecoder` for already-parsed generic Kotlin map/list values. It requires exact field sets, exact scalar types, exact capability keys, and then re-runs the response policy before returning accepted typed models.
- The wire decoder does not parse JSON, coerce strings/booleans, perform I/O, carry credentials, or authenticate a session.
- Account identifiers remain opaque and exact. The Android contract does not trim, case-fold, decode, or otherwise reinterpret account identity; it only validates and percent-encodes the identifier when constructing a relative request path.
- Response allowlists exclude session user identity and credential material. Account-list duplicates, detail/request identity drift, malformed timestamps, unknown/missing fields, unknown/missing capability keys, scalar-type drift, control-bearing text, and excessive account counts fail closed.
- Fail-closed Development behavior: no `INTERNET` permission and no provider/account transport authority is claimed.
- Android backup disabled for the current shell.
- JVM coverage for capability truthfulness, session binding, provider request paths, response acceptance, and exact-field decoding.
- Android Client CI validates the V1.4/source-authority boundary, JVM tests, and debug APK assembly.
- Gradle caching, parallel execution, and incremental Kotlin compilation enabled.

The source-ready read/response/decoder stack is not live provider access. It adds no HTTP client, browser-cookie bridge, bearer token, OAuth token, IMAP/SMTP credential, provider password, local authoritative account store, mailbox/message transport, or background synchronization.

The exact current Mail service router does not yet expose the mailbox/message/search/session read routes represented by the browser provider interface. Android therefore must not treat those browser methods as native service authority until corresponding server routes are implemented and independently accepted.

The session-binding contract is not an authentication implementation. It does not create or persist credentials, register Mail with GoreeCloud Identity, exchange bearer/refresh tokens, copy browser cookies, enable network transport, or authorize provider access. External-provider authorization remains a separate authority from GoreeCloud Identity.

## Platform-system boundary

The Android Development line is evaluated independently against all eight GoreeCloud Platform Systems: Manager, Privacy Shield, Wardveil Security, Everkeep, GLAZE UI, Mesh, Identity, and Sync.

Current source/build evidence does not establish accepted runtime integration for Manager, Privacy Shield, Wardveil Security, Everkeep, Mesh, Identity, or Sync. GLAZE UI V1.4 source adoption remains `ADOPTION_IN_PROGRESS`; application-level rendered/accessibility/device acceptance and applicable V1.4.1 manual qualification remain separate.

GoreeCloud Sync must not be inferred from provider synchronization, local cache/storage, background work, offline replay, or Everkeep backup/recovery.

## Next Android work

Advance each capability independently and preserve truthful authority boundaries:

1. Define and accept first-party GoreeCloud Identity native application registration and credential/session exchange for Android Mail without reusable application-wide credentials.
2. Add a bounded byte/UTF-8/JSON parsing boundary that produces generic values for the existing exact-field decoder without network authority; keep body-size and malformed-input rejection explicit.
3. Add a bounded authenticated same-service transport adapter for account discovery/capabilities against non-production Development accounts. Do not enable mailbox/message routes that the server does not yet expose.
4. Implement and accept server-side read routes for mailbox/message/session/search behavior before adding the corresponding Android request/response contracts.
5. Add protected local message/index storage with explicit data minimization, encryption/key custody, eviction, and recovery behavior.
6. Add bounded background work and push-notification authority.
7. Add attachment download/open/share behavior under accepted Wardveil Security and Privacy Shield policy.
8. Add offline queueing, version/conflict handling, and explicit GoreeCloud Sync integration where applicable.
9. Complete repository-wide GLAZE UI V1.4 migration, Android rendered/accessibility/form-factor/representative-device acceptance, and applicable V1.4.1 human/manual checks.
10. Complete Everkeep backup/restore behavior for Mail-owned Android state where applicable.
11. Add APK/AAB provenance/SBOM, protected signing, rollback/upgrade evidence, Release Candidate, production, and Stable gates.

Signing material, reusable secrets, provider credentials, and production Identity credentials must remain outside GitHub and outside source-controlled application configuration.
