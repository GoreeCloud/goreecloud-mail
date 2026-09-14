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
- Source-ready consumer acceptance gate for GoreeCloud Identity native application-registration records, pinned to Identity Development revision `73c3c00ff44906849baa711c588a0466e72999d7` and schema `goreecloud.identity.native-application-registration/v1`.
- The pinned Identity registry is explicitly empty. Android Mail therefore has no authoritative application ID, public native client ID, registered redirect URI, or allowed scope set yet, and the registration gate cannot activate runtime transport.
- The registration decoder accepts only the exact public registration fields (`applicationId`, `clientId`, `audience`, `redirectUris`, `allowedScopes`, and `enabled`); owning credentials or unknown fields are rejected.
- Registration matching is exact and fail closed for disabled records, application/client/audience drift, unregistered redirects, scope expansion, wildcard values, malformed redirects, and unapproved loopback Development redirects.
- Source-ready transport-neutral provider-account contract for the trusted account list/detail/capability GET boundaries.
- Source-ready exact-field in-memory decoder for provider-account responses. It rejects missing/unknown fields and type coercion before semantic acceptance and intentionally adds no JSON or network library.
- Exact opaque account IDs are preserved and encoded only as path segments; account responses accept only public account metadata and exclude owning user IDs and reusable credentials.
- Capability responses require the complete canonical Courier/Mail capability vocabulary and exact account/provider binding before native acceptance.
- Fail-closed Development behavior: no `INTERNET` permission and no provider/account transport authority is claimed.
- Android backup disabled for the current shell.
- JVM coverage for capability truthfulness, session binding, Identity registration shape/matching, account path/shape rules, decoder field/type rejection, account/provider mismatch, and capability-vocabulary drift.
- Android Client CI validates the V1.4/source authority boundary, JVM tests, and debug APK assembly.

The session-binding, Identity-registration, provider-account, and decoder contracts are prerequisites, not authentication or transport implementations. They do not create or persist credentials, self-register Mail with GoreeCloud Identity, exchange bearer/refresh tokens, copy browser cookies, enable network transport, authorize provider access, or access mailbox content. External-provider authorization remains a separate authority from GoreeCloud Identity.

The trusted backend remains responsible for deriving the GoreeCloud user from authenticated session state, enforcing account ownership, resolving provider type, holding reusable provider credentials, and invoking provider implementations. Android source must not accept client-selected owner identity as authority.

## Identity registration blocker

GoreeCloud Identity currently defines the native application-registration contract but its pinned `registrations` array is empty. Mail therefore remains blocked on an Identity-owned registration that must establish the exact public native client configuration rather than allowing Mail to invent it.

The tracked implementation obligation is Linear `GOR-27` — **Register GoreeCloud Mail Android with GoreeCloud Identity**. Completion requires an exact Identity revision containing the Mail registration plus Identity contract/CI evidence and corresponding Mail acceptance tests. A registration alone still does not establish production Identity runtime, provider authorization, Privacy Shield/Wardveil acceptance, or Stable status.

## Platform-system boundary

The Android Development line is evaluated independently against Manager, Privacy Shield, Wardveil Security, Everkeep, GLAZE UI, Mesh, Identity, and Sync. Current source/build evidence does not establish accepted runtime integration for Manager, Privacy Shield, Wardveil Security, Everkeep, Mesh, Identity, or Sync. GLAZE UI V1.4 source adoption remains `ADOPTION_IN_PROGRESS`; rendered/accessibility/device acceptance and applicable V1.4.1 manual qualification remain separate.

GoreeCloud Sync must not be inferred from provider synchronization, local cache/storage, background work, offline replay, or Everkeep backup/recovery.

## Next Android work

1. Complete `GOR-27`: define and validate an Identity-owned Android Mail registration with exact application ID, public native client ID, audience, redirect URI(s), scopes, and lifecycle state.
2. Bind the current consumer registration gate to that exact authoritative registration and validate disabled/change/revocation behavior.
3. Implement and accept the first-party native Identity authorization/session runtime using the approved authorization-code + PKCE profile, external user agent, state/nonce handling, protected credential storage, token rotation/revocation, and session visibility without reusable application-wide credentials.
4. Only after accepted Identity/runtime authority, add a bounded authenticated same-service transport adapter for read-only provider-account discovery against non-production Development data.
5. Define mailbox/message request, exact-field decode, and response acceptance contracts before enabling mailbox retrieval.
6. Add protected local message/index storage with explicit data-minimization, encryption/key-custody, eviction, and recovery behavior.
7. Add bounded background work and push-notification authority.
8. Add attachment download/open/share behavior under accepted Wardveil Security and Privacy Shield policy.
9. Add offline queueing, version/conflict handling, and explicit GoreeCloud Sync integration where applicable.
10. Complete repository-wide GLAZE UI V1.4 migration, Android rendered/accessibility/form-factor/representative-device acceptance, and applicable V1.4.1 human/manual checks.
11. Complete Everkeep backup/restore behavior for Mail-owned Android state where applicable.
12. Add APK/AAB provenance/SBOM, protected signing, rollback/upgrade evidence, Release Candidate, production, and Stable gates.

Signing material, reusable secrets, provider credentials, and production Identity credentials must remain outside GitHub and outside source-controlled application configuration.
