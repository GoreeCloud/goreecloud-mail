# GoreeCloud Mail Architecture

## Product boundary

GoreeCloud Mail is a first-party email client. It does not operate an email server, MX service, outbound delivery platform, DKIM infrastructure, or sender-reputation system.

## Initial layers

1. **Client shell** — responsive Glaze UI web experience.
2. **Mail provider contract** — provider-independent operations and capability discovery.
3. **Provider gateway** — authenticated same-origin application API that shields reusable provider credentials from browser code.
4. **Provider adapters** — Gmail API and standards-based IMAP/SMTP implementations behind the gateway.
5. **Security and privacy boundary** — Wardveil Security and Privacy Shield controls around untrusted message content, links, attachments, and remote resources.
6. **Suite integrations** — Contacts, Calendar, Tasks, Notes/Memos, Notify, and Identity through documented interfaces.

## Provider contract

Every adapter is expected to expose these logical operations:

- authenticate
- listMailboxes
- listMessages
- getMessage
- search
- send
- createDraft
- updateDraft
- move
- archive
- remove
- flag
- sync
- capabilities

Adapters must report unsupported capabilities rather than allowing the client to infer them.

## Provider gateway boundary

The browser client does not receive reusable Gmail refresh tokens, IMAP passwords, SMTP passwords, application passwords, or other provider secrets. Browser requests use the authenticated GoreeCloud Mail session and call a same-origin `/api/mail` gateway. The gateway owns provider authorization state and exposes only normalized mail operations.

This boundary is particularly important for IMAP and SMTP because browser JavaScript must not open raw mail-protocol sockets or persist mailbox credentials. Linux and Android clients may later use platform-specific secure credential stores, but they must preserve the same logical provider contract and account-isolation requirements.

The current source includes a generic `ProviderGateway` and `GatewayMailProvider`. They establish routing and credential boundaries only; they do not yet connect to a real Gmail, IMAP, or SMTP account.

## Authentication direction

Gmail should use modern delegated authorization such as OAuth with authorization-code flow and PKCE where applicable. Provider refresh credentials belong in the trusted application/backend credential boundary, not localStorage, source code, repository files, URLs, analytics, or routine logs.

Standards-based providers should prefer OAuth-capable IMAP/SMTP when supported. Application passwords or ordinary mailbox passwords may be supported only where required by a provider and must remain in approved secret storage rather than client-visible configuration.

## Data rules

The provider remains authoritative for mailbox state. Local or GoreeCloud-hosted data may cache mailbox content for offline operation, indexing, synchronization, and notifications, but cached state is subordinate unless a future architecture explicitly changes that boundary.

## Client direction

The first implementation target is the web shell. Linux desktop and Android clients will reuse shared product contracts where practical. iOS remains a later target after synchronization, authentication, and provider behavior are stable.

## Security model

Email is hostile input. Production implementations must sanitize HTML, restrict remote content, validate attachment metadata and paths, isolate accounts, protect provider credentials, and prevent sensitive message data from entering routine logs.

The initial security module rejects executable and unsupported URL schemes and keeps remote content blocked by default. These helpers are foundation controls only; production HTML rendering will require a dedicated parser/sanitizer boundary and runtime acceptance tests before real mailbox content is approved.
