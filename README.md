# GoreeCloud Mail

Privacy-first, self-hosted GoreeCloud email client for web, Linux, and Android with provider-independent mail access, Glaze UI, and Wardveil Security.

## Status

Active development. The Glaze UI web foundation, provider-independent mail contract, same-origin provider gateway, trusted session identity boundary, user-scoped provider-account registry, OAuth authorization-state lifecycle, credential-vault abstraction, Gmail token lifecycle service, ownership-enforced Gmail account service, bounded provider request policy, isolated synchronization-state store, normalized provider errors, Wardveil message-link controls, Privacy Shield remote-content defaults, synthetic Gmail API transport, and durable-state schema blueprint are implemented as development foundations.

Production deployment is not approved. Real Gmail and IMAP/SMTP connectivity, approved durable persistence, production secret storage, production HTML sanitization, native packaging, and target-environment acceptance remain pending.

## Role

GoreeCloud Mail is the first-party email client and communication interface for GoreeCloud. It connects to approved external email providers and does **not** operate an email server.

## Planned clients

- Web
- Linux desktop
- Android
- iOS (long-term target)

## Core architecture

The application uses a provider-independent mail layer with planned real-provider support for Gmail APIs and standards-based IMAP/SMTP providers. Browser clients communicate through an authenticated same-origin `/api/mail` gateway rather than receiving reusable provider credentials.

Server-side development foundations enforce session-derived GoreeCloud user identity, user-scoped provider-account lookup, single-use and expiring OAuth authorization state, application-relative redirect validation, bounded provider errors, and a separate credential-vault boundary. The trusted Gmail API client resolves bearer tokens server-side and keeps them out of normalized client-facing records.

The Gmail token lifecycle service reuses unexpired access tokens, refreshes expired tokens through the trusted backend, preserves refresh credentials when providers omit a replacement, and can revoke authorization upstream before removing local credential state. The Gmail account service verifies session-derived ownership and provider type before any Gmail transport operation is allowed to run.

Provider transport now uses a bounded request policy with per-attempt timeouts, retry limits, exponential backoff, capped Retry-After handling, and retry classification that does not retry authentication failures. The policy is applied behind the trusted Gmail transport boundary rather than in browser code.

`docs/persistence-schema.sql` defines the intended durable-state separation for provider-account metadata, credential references, OAuth authorization state, synchronization cursors, and mailbox cache state. It deliberately stores only vault references for reusable credentials; secret values remain outside ordinary application persistence.

The development synchronization-state store mirrors those isolation semantics for cursor and mailbox synchronization status. Cursor and mailbox state are scoped by user and account, public records omit the owning user identifier, failed attempts preserve the last known successful synchronization time, and later success clears stale error state.

Current in-memory server components and injected synthetic Gmail responses exist to prove security, isolation, lifecycle, retry, synchronization, and normalization semantics only. They must be replaced or connected to approved production persistence, secret storage, and provider transport before deployment.

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

Cross-user provider-account, credential, and synchronization-state references fail closed. Gmail transport additionally verifies that the selected account belongs to the authenticated user and is actually a Gmail account before provider operations begin. OAuth authorization state is user-scoped, provider-scoped, short-lived, and single-use. Remote message content remains blocked by default until the approved privacy policy permits it.

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

Passing source tests do not constitute production acceptance. Real provider connectivity, production persistence, credential storage, runtime hardening, target-environment validation, and production-readiness acceptance remain separate requirements.

## License

License selection is pending final project approval.
