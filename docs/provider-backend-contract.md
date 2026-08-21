# Trusted Provider Backend Contract

## Purpose

GoreeCloud Mail uses a trusted backend boundary between user-facing clients and external mail providers. Browser clients never receive reusable Gmail refresh tokens, IMAP passwords, SMTP passwords, application passwords, or provider client secrets.

## Session boundary

Every `/api/mail` request must be associated with an authenticated GoreeCloud Mail session. The backend derives the GoreeCloud user identity from that session; callers do not choose an arbitrary user identifier in a request body, query string, or provider path.

Provider-account records are scoped to the authenticated GoreeCloud user. A provider account identifier is an opaque GoreeCloud identifier and must not grant access when presented by a different user.

## Authorization state

Provider authorization state belongs in trusted server-side storage.

For Gmail, the intended flow is authorization code with PKCE where applicable. The backend creates short-lived authorization state, validates the callback state and redirect target, exchanges the authorization code with Google, and stores reusable provider credentials only in approved secret storage.

For standards-based accounts, the backend owns IMAP/SMTP OAuth credentials or, only where necessary, application passwords or mailbox passwords. Those values are never returned by provider-account APIs after enrollment.

## Normalized provider operations

The backend exposes provider-independent operations under `/api/mail/providers/{provider}`. Implementations normalize provider-specific data into GoreeCloud Mail mailbox, message, draft, attachment, and capability models.

Supported logical operations remain:

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

Unsupported capabilities must be explicit rather than inferred from errors.

## Account isolation

All account, mailbox, message, attachment, draft, synchronization, and credential lookups must include the authenticated GoreeCloud user scope. Provider-native identifiers are not globally trusted identifiers.

Cross-account and cross-user object references fail closed. The backend must not reveal whether an inaccessible object exists for another user.

## Logging and observability

Routine logs may contain request correlation identifiers, provider type, normalized operation name, coarse outcome, duration, and safe error classification.

Routine logs must not contain:

- access or refresh tokens
- passwords or application passwords
- authorization codes
- session cookies
- complete message bodies
- attachment contents
- unnecessary recipient lists or subject text

Provider errors are translated to bounded GoreeCloud Mail errors before reaching clients.

## Message-content boundary

Provider responses and message content remain untrusted even after successful provider authentication. HTML rendering requires a dedicated sanitizer boundary. Remote resources remain blocked by default under Privacy Shield. Attachments are inert data until explicitly opened or downloaded through an approved path.

## Persistence direction

The provider remains authoritative for mailbox state. GoreeCloud Mail may persist normalized metadata, synchronization cursors, search indexes, offline cache records, and notification state. Cached message content must follow retention, encryption, account-isolation, and deletion rules before production use.

## Acceptance requirements

Real-provider connectivity is not production-ready until tests prove at minimum:

1. authorization state cannot be replayed or redirected to an unapproved target;
2. reusable credentials never appear in browser-visible responses or routine logs;
3. one GoreeCloud user cannot address another user's provider account or cached mail objects;
4. provider errors are normalized without leaking credentials or sensitive protocol details;
5. HTML and remote-content controls remain enforced on real provider data;
6. account revocation removes or invalidates reusable provider authorization state;
7. synchronization can resume safely without duplicating destructive operations.
