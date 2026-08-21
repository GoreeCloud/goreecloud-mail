# GoreeCloud Mail

Privacy-first, self-hosted GoreeCloud email client for web, Linux, and Android with provider-independent mail access, Glaze UI, and Wardveil Security.

## Status

Active development. The Glaze UI web foundation, provider-independent mail contract, same-origin provider gateway, trusted session identity boundary, user-scoped provider-account registry and service, OAuth authorization-state lifecycle, bounded mail API router, Gmail OAuth request construction, Gmail payload normalization, normalized provider errors, Wardveil message-link controls, and Privacy Shield remote-content defaults are implemented as development foundations.

Production deployment is not approved. Real Gmail and IMAP/SMTP connectivity, production persistence, credential-vault integration, production HTML sanitization, native packaging, and target-environment acceptance remain pending.

## Role

GoreeCloud Mail is the first-party email client and communication interface for GoreeCloud. It connects to approved external email providers and does **not** operate an email server.

## Planned clients

- Web
- Linux desktop
- Android
- iOS (long-term target)

## Core architecture

The application uses a provider-independent mail layer with planned real-provider support for Gmail APIs and standards-based IMAP/SMTP providers. Browser clients communicate through an authenticated same-origin `/api/mail` gateway rather than receiving reusable provider credentials.

Server-side development foundations enforce session-derived GoreeCloud user identity, user-scoped provider-account lookup, single-use and expiring OAuth authorization state, application-relative redirect validation, bounded provider errors, and provider-account API routing. Current in-memory server components exist to prove security and isolation semantics only and must be replaced with approved production persistence before deployment.

The Gmail foundation currently constructs PKCE-based OAuth requests and normalizes synthetic Gmail message and label payloads into provider-independent GoreeCloud Mail records. It does not exchange real authorization codes, store real tokens, or call the Gmail API yet.

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

Cross-user provider-account references fail closed. OAuth authorization state is user-scoped, provider-scoped, short-lived, and single-use. Remote message content remains blocked by default until the approved privacy policy permits it.

## Validation

Run the complete source test suite with:

```bash
npm test
```

Run the trusted-backend-focused suite with:

```bash
npm run test:backend
```

GitHub Actions also runs source tests and static secret-safety checks on pull requests and development branches.

## License

License selection is pending final project approval.
