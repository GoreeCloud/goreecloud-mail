# GoreeCloud Mail

Privacy-first, self-hosted GoreeCloud email client for web, Linux, and Android with provider-independent mail access, Glaze UI, and Wardveil Security.

## Status

Active development. The Glaze UI web foundation, provider-independent mail contract, same-origin provider gateway, trusted session identity boundary, user-scoped provider-account registry, OAuth authorization-state lifecycle, credential-vault abstraction, normalized provider errors, Wardveil message-link controls, Privacy Shield remote-content defaults, and synthetic Gmail API transport foundation are implemented as development foundations.

Production deployment is not approved. Real Gmail and IMAP/SMTP connectivity, production persistence, production secret storage, production HTML sanitization, native packaging, and target-environment acceptance remain pending.

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

Current in-memory server components and injected synthetic Gmail responses exist to prove security, isolation, and normalization semantics only. They must be replaced or connected to approved production persistence, secret storage, and provider transport before deployment.

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

Cross-user provider-account and credential references fail closed. OAuth authorization state is user-scoped, provider-scoped, short-lived, and single-use. Remote message content remains blocked by default until the approved privacy policy permits it.

## Validation

Run the source test suite with:

```bash
npm test
```

Run the trusted backend and Gmail foundation tests with:

```bash
npm run test:backend
```

GitHub Actions also runs source tests and static secret-safety checks on pull requests and development branches. Exact-head CI run #72 / 32464487135 passed on commit `56e1b79f43a12adf2531ab1c52cc74b85b382051` after the credential-vault and Gmail transport foundation was added.

Passing source tests do not constitute production acceptance. Real provider connectivity, production persistence, credential storage, runtime hardening, target-environment validation, and production-readiness acceptance remain separate requirements.

## License

License selection is pending final project approval.
