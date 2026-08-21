# GoreeCloud Mail

Privacy-first, self-hosted GoreeCloud email client for web, Linux, and Android with provider-independent mail access, Glaze UI, and Wardveil Security.

## Status

Active development. The Glaze UI web foundation, provider-independent mail contract, same-origin provider gateway, trusted session identity boundary, user-scoped provider-account registry, OAuth authorization-state lifecycle, credential-vault abstraction, Gmail token lifecycle service, ownership-enforced Gmail account service, bounded provider request policy, synchronization-state and operation-idempotency foundations, fail-closed message-content rendering boundary, normalized provider errors, Wardveil message-link controls, Privacy Shield remote-content defaults, synthetic Gmail API transport, durable-state schema, SQLite durable-state adapter, encrypted credential-vault adapter, schema-version framework, and SQLite backup/integrity-verification tooling are implemented.

The SQLite adapter persists provider accounts, provider credential-vault references, SHA-256-hashed OAuth authorization state, synchronization cursors, mailbox synchronization state, and operation-idempotency records. Raw OAuth state values are not stored; only hashes are persisted. PKCE verifier material remains outside ordinary application state and may be represented only by a secret-store reference. Public credential-reference descriptors do not disclose the underlying vault key.

The encrypted credential vault stores reusable provider credential payloads separately using AES-256-GCM with a runtime-supplied 32-byte key, fresh IVs, atomic replacement, restrictive file permissions, and authenticated decryption. Encryption-key rotation is implemented and source-tested.

SQLite schema version 1 is now explicitly recorded through `schema_migrations`. `server/sqlite-migrations.js` provides ordered transactional migration semantics, while `server/sqlite-backup.js` creates non-overwriting consistent snapshots with `VACUUM INTO` and immediately verifies them with SQLite `integrity_check` plus schema-version reporting.

Production deployment is not approved. Real Gmail and IMAP/SMTP connectivity, target-host encrypted secret-store acceptance, database migration and backup/restore acceptance, a maintained production HTML sanitizer, native packaging, and target-environment acceptance remain pending.

## Role

GoreeCloud Mail is the first-party email client and communication interface for GoreeCloud. It connects to approved external email providers and does **not** operate an email server.

## Planned clients

- Web
- Linux desktop
- Android
- iOS (long-term target)

## Core architecture

The application uses a provider-independent mail layer with planned real-provider support for Gmail APIs and standards-based IMAP/SMTP providers. Browser clients communicate through an authenticated same-origin `/api/mail` gateway rather than receiving reusable provider credentials.

Server-side foundations enforce session-derived GoreeCloud user identity, user-scoped provider-account lookup, single-use and expiring OAuth authorization state, application-relative redirect validation, bounded provider errors, and a separate credential-vault boundary. The trusted Gmail API client resolves bearer tokens server-side and keeps them out of normalized client-facing records.

The Gmail token lifecycle service reuses unexpired access tokens, refreshes expired tokens through the trusted backend, preserves refresh credentials when providers omit a replacement, and can revoke authorization upstream before removing local credential state. The Gmail account service verifies session-derived ownership and provider type before any Gmail transport operation is allowed to run.

Provider transport uses a bounded request policy with per-attempt timeouts, retry limits, exponential backoff, capped Retry-After handling, and retry classification that does not retry authentication failures. The policy is applied behind the trusted Gmail transport boundary rather than in browser code.

`docs/persistence-schema.sql` defines durable-state separation for schema versions, provider-account metadata, credential references, OAuth authorization state, synchronization cursors, mailbox cache state, and operation-idempotency records. Reusable provider secrets are deliberately absent from ordinary application tables.

`server/sqlite-state.js` is the first durable application-state implementation. It uses Node's SQLite runtime, enables foreign-key enforcement, initializes the repository schema idempotently, persists provider accounts, provider credential-vault references, OAuth authorization state, synchronization cursors, mailbox synchronization state, and operation-idempotency state across process restarts, and provides an explicit transaction boundary so related durable changes can be committed or rolled back together.

OAuth state is persisted by SHA-256 hash rather than as the browser-visible bearer value. Durable state consumption remains user- and provider-scoped, short-lived, and single-use. An optional PKCE verifier reference can be persisted, but not the verifier secret itself. Credential-reference APIs expose only a non-secret descriptor to ordinary callers; trusted backend code can resolve the stored vault key when it needs to address the separate secret store.

`server/sqlite-migrations.js` records repository schema versions and applies pending migrations within `BEGIN IMMEDIATE` transactions. The initial baseline is schema version 1. `server/sqlite-backup.js` refuses source overwrite and existing backup destinations, creates a consistent SQLite snapshot, runs `PRAGMA integrity_check`, and reports the stored schema version. `docs/database-maintenance.md` defines the associated recovery and production-acceptance contract.

The in-memory synchronization, OAuth-state, credential-vault, and idempotency components remain useful deterministic test doubles. Production acceptance of SQLite still requires target-filesystem permissions, controlled backup scheduling, restore rehearsal, corruption/recovery handling, migration rollback/recovery procedure, and operational observability. Production reusable credentials still require target-host acceptance of the encrypted vault and its independent key custody.

The message-content policy fails closed for HTML unless an approved sanitizer is injected. Plain text is HTML-escaped, remote content remains disabled by default, and defense-in-depth checks reject obviously active markup before and after sanitizer execution. These checks are not treated as a substitute for a production sanitizer.

Injected synthetic Gmail responses continue to prove security, isolation, lifecycle, retry, synchronization, idempotency, content-boundary, normalization, encryption, persistence, migration, backup, and recovery semantics without connecting a real mailbox.

The UI uses Glaze UI, security-sensitive experiences use Wardveil Security, and privacy protections align with GoreeCloud Privacy Shield.

## Planned integrations

- GoreeCloud Contacts
- GoreeCloud Calendar
- GoreeCloud Tasks
- GoreeCloud Notes / Memos
- GoreeCloud Notify
- GoreeCloud Identity

## Security boundary

Email content, HTML, links, attachments, provider responses, and remote resources are untrusted input. Credentials, OAuth codes, refresh tokens, app passwords, session material, and other secrets must never be committed to this repository or exposed through browser-visible provider responses.

Cross-user provider-account, credential-reference, synchronization-state, and idempotency references fail closed. Gmail transport additionally verifies that the selected account belongs to the authenticated user and is actually a Gmail account before provider operations begin. OAuth authorization state is user-scoped, provider-scoped, short-lived, single-use, and stored only by hash in durable state. Remote message content remains blocked by default until the approved privacy policy permits it.

Application-database backups can still contain private account and synchronization metadata even though reusable provider secrets are excluded. They must therefore remain protected and must not be published through web roots, static hosting, source control, or public backup paths.

## Validation

Run the source test suite with:

```bash
npm test
```

Run the trusted backend and Gmail foundation tests with:

```bash
npm run test:backend
```

GitHub Actions also runs source tests and static secret-safety checks on pull requests and development branches. Exact-head CI is required after each material backend/security milestone before the source state is described as validated.

Passing source tests do not constitute production acceptance. Real provider connectivity, target-host encrypted credential storage, approved HTML sanitization, durable database backup/recovery, runtime hardening, target-environment validation, and production-readiness acceptance remain separate requirements.

## License

License selection is pending final project approval.
