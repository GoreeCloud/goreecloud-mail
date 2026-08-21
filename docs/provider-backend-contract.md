# Trusted Provider Backend Contract

## Purpose

GoreeCloud Mail uses a trusted backend boundary between user-facing clients and external mail providers. Browser clients never receive reusable Gmail refresh tokens, IMAP passwords, SMTP passwords, application passwords, or provider client secrets.

## Session boundary

Every `/api/mail` request must be associated with an authenticated GoreeCloud Mail session. The backend derives the GoreeCloud user identity from that session; callers do not choose an arbitrary user identifier in a request body, query string, or provider path.

Provider-account records are scoped to the authenticated GoreeCloud user. A provider account identifier is an opaque GoreeCloud identifier and must not grant access when presented by a different user.

## Provider-account API boundary

Provider-account operations are routed through a trusted service that derives ownership from the authenticated session. The development router currently exposes normalized account operations under `/api/mail/accounts` for listing, creating, retrieving, and removing provider-account records.

Cross-user references fail closed with the same not-found state used for absent records. Public provider-account representations do not expose the internal GoreeCloud owning-user identifier.

The current router and account registry are development foundations only. Production deployment requires approved persistent storage, request parsing and body limits, CSRF/session protections appropriate to the chosen web framework, rate limiting where required, and integration with the production authentication boundary.

## Authorization state

Provider authorization state belongs in trusted server-side storage.

For Gmail, the intended flow is authorization code with PKCE. The backend creates short-lived authorization state, validates the callback state and redirect target, exchanges the authorization code with Google, and stores reusable provider credentials only in approved secret storage.

The current Gmail OAuth source can generate PKCE S256 verifier/challenge pairs, construct the Google authorization request, and construct an authorization-code token-exchange request body. It does not perform a real token exchange and contains no production OAuth secret or provider token.

For standards-based accounts, the backend owns IMAP/SMTP OAuth credentials or, only where necessary, application passwords or mailbox passwords. Those values are never returned by provider-account APIs after enrollment.

## Credential-vault boundary

Reusable provider credentials are separate from provider-account metadata. The credential vault is addressed only with both the authenticated GoreeCloud user scope and the opaque GoreeCloud provider-account identifier.

The development in-memory credential vault proves these semantics:

- secrets are scoped by both user and account;
- reads return isolated copies rather than mutable internal references;
- public credential descriptors expose configuration state but not token or password values;
- cross-user secret lookups fail as not found;
- removal invalidates subsequent reads.

The in-memory vault is not approved for production. Production must use an approved encrypted secret store with explicit access controls, lifecycle and revocation behavior, backup/recovery decisions, auditing appropriate to sensitive material, and no routine secret disclosure through logs or client responses.

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

## Gmail normalization foundation

Gmail-native message and label records must be normalized before they enter shared client logic. The development normalizer currently maps synthetic Gmail message metadata into provider-independent identifiers, thread identifiers, subject, sender, recipients, date, snippet, unread/starred state, labels, estimated size, and attachment-presence fields.

Missing provider values remain absent or null rather than being invented. Message bodies, HTML, MIME parts, attachment downloads, and synchronization history remain separate future normalization boundaries and must be handled as untrusted provider input.

## Gmail transport boundary

The trusted backend now includes a Gmail API client foundation that accepts a server-side token resolver rather than a raw browser-provided token. The client can list labels, list message references, and retrieve a full message through the Gmail API contract while normalizing provider errors before they cross the backend boundary.

Bearer authorization is attached only inside the trusted transport request. Access tokens are not included in normalized labels, message references, normalized messages, or public error bodies.

The current transport is still a development foundation. Tests use injected synthetic responses; no real Google account, token, or mailbox has been connected. Production use additionally requires token refresh/revocation handling, bounded timeouts, retry policy, rate-limit policy, observability without secret leakage, and end-to-end account ownership enforcement around each transport call.

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

The development in-memory provider-account registry, OAuth-state store, and credential vault are not approved production persistence mechanisms. Production storage must preserve user/account isolation and separate reusable provider credentials from ordinary application records.

## Acceptance requirements

Real-provider connectivity is not production-ready until tests prove at minimum:

1. authorization state cannot be replayed or redirected to an unapproved target;
2. reusable credentials never appear in browser-visible responses or routine logs;
3. one GoreeCloud user cannot address another user's provider account or cached mail objects;
4. provider errors are normalized without leaking credentials or sensitive protocol details;
5. HTML and remote-content controls remain enforced on real provider data;
6. account revocation removes or invalidates reusable provider authorization state;
7. synchronization can resume safely without duplicating destructive operations;
8. provider-account API routing cannot override session-derived user ownership;
9. Gmail provider payloads are normalized without inventing missing data or passing unsafe provider content directly into shared rendering paths;
10. provider credentials remain isolated in the credential-vault boundary and cannot be retrieved by another GoreeCloud user;
11. Gmail transport responses never return bearer tokens or raw upstream error bodies to client-facing code.
