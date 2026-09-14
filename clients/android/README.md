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
- Source-ready selected-provider-account read contract for the existing `GET /api/mail/accounts/{accountId}` trusted-backend route.
- Source-ready account-scoped capability read contract for `GET /api/mail/accounts/{accountId}/capabilities`, requiring the exact normalized Courier capability vocabulary and matching account/provider authority.
- Exact public provider-account response scope: `id`, `provider`, `externalAccountId`, `displayName`, and `createdAt`; owning-user identifiers and reusable provider credentials are not accepted fields.
- Fail-closed opaque account identifiers: bounded, canonical, control-free values are percent-encoded only as a path segment and are never trimmed, case-folded, decoded, provider-selected, or converted into another account identity convention.
- Mailbox and message read contracts remain `BACKEND_BLOCKED` because the exact parent backend router does not currently expose corresponding GET routes. Browser adapter method names are not treated as proof that those backend operations exist.
- Fail-closed Development behavior: no `INTERNET` permission, live GoreeCloud Identity session, provider transport, or provider/account runtime authority is claimed.
- Android backup disabled for the current shell.
- JVM coverage for capability truthfulness, session-binding rejection/acceptance rules, provider-account identity/path handling, exact response field boundaries, and normalized capability vocabulary enforcement.
- Android Client CI validating the V1.4/source boundary, JVM tests, and debug APK assembly.
- Gradle caching, parallel execution, and incremental Kotlin compilation enabled.

The source-ready contracts are not authentication or transport implementations. They do not create or persist credentials, register Mail with GoreeCloud Identity, exchange bearer/refresh tokens, copy browser cookies, perform HTTP, access a provider mailbox, or authorize provider operations. External-provider authorization remains a separate authority from GoreeCloud Identity.

The current trusted backend remains authoritative for user/account ownership and capability resolution. Android cannot select provider authority merely by naming Gmail, IMAP/SMTP, Outlook, Yahoo, or another provider. Provider-dependent actions must continue to resolve the opaque account under the authenticated GoreeCloud user and require the applicable normalized capability at the trusted boundary.

## Platform-system boundary

The Android Development line is evaluated independently against all eight GoreeCloud Platform Systems: Manager, Privacy Shield, Wardveil Security, Everkeep, GLAZE UI, Mesh, Identity, and Sync.

Current source/build evidence does not establish accepted runtime integration for Manager, Privacy Shield, Wardveil Security, Everkeep, Mesh, Identity, or Sync. GLAZE UI V1.4 source adoption remains `ADOPTION_IN_PROGRESS`; application-level rendered/accessibility/device acceptance and applicable V1.4.1 manual qualification remain separate.

GoreeCloud Sync must not be inferred from provider synchronization, local cache/storage, background work, offline replay, or Everkeep backup/recovery.

## Next Android work

Advance each capability independently and preserve truthful authority boundaries:

1. Add an exact-field decoder for the selected-account and capability responses; unknown fields must fail closed before typed values reach `MailProviderAccountContract`.
2. Define and accept first-party GoreeCloud Identity native application registration and credential/session exchange for Android Mail without reusable application-wide credentials.
3. Expose and independently validate bounded trusted-backend mailbox/message read routes before the Android client models them as source-ready.
4. Add authenticated provider-independent Android transport only after the accepted Identity/session and trusted-backend route boundaries exist; do not place provider credentials in the Android client.
5. Add protected local message/index storage with explicit data-minimization, encryption/key-custody, eviction, and recovery behavior.
6. Add bounded background work and push-notification authority.
7. Add attachment download/open/share behavior under accepted Wardveil Security and Privacy Shield policy.
8. Add offline queueing, version/conflict handling, and explicit GoreeCloud Sync integration where applicable.
9. Complete repository-wide GLAZE UI V1.4 migration, Android rendered/accessibility/form-factor/representative-device acceptance, and applicable V1.4.1 human/manual checks.
10. Complete Everkeep backup/restore behavior for Mail-owned Android state where applicable.
11. Add APK/AAB provenance/SBOM, protected signing, rollback/upgrade evidence, Release Candidate, production, and Stable gates.

Signing material, reusable secrets, provider credentials, and production Identity credentials must remain outside GitHub and outside source-controlled application configuration.
