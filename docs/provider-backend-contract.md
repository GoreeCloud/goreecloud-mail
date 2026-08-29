# Trusted Provider Backend Contract

## Purpose

GoreeCloud Mail uses a trusted backend boundary between user-facing clients and compatible external mail providers. Browser clients never receive reusable Gmail refresh tokens, Microsoft/Yahoo/provider OAuth refresh credentials, IMAP passwords, SMTP passwords, application passwords, provider client secrets, or equivalent long-lived provider credentials.

GoreeCloud Mail remains a client platform. External providers remain authoritative for mailbox hosting and Internet mail transport. The trusted backend mediates authorized provider access and GoreeCloud-native workflows; it is not an MX service, hosted mailbox provider, or GoreeCloud Internet mail transport.

## Session Boundary

Every `/api/mail` request must be associated with an authenticated GoreeCloud Mail session. The backend derives the GoreeCloud user identity from that session. Callers do not choose an arbitrary user identifier in a request body, query string, provider path, or capability claim.

Provider-account records are scoped to the authenticated GoreeCloud user. A provider account identifier is an opaque GoreeCloud identifier and must not grant access when presented by another user.

## Provider-Account API Boundary

Provider-account operations are routed through a trusted service that derives ownership from the authenticated session. The development router exposes normalized account operations under `/api/mail/accounts` for listing, creating, retrieving, removing, and discovering capabilities for provider-account records.

Current account routes include:

```text
GET    /api/mail/accounts
POST   /api/mail/accounts
GET    /api/mail/accounts/{accountId}
DELETE /api/mail/accounts/{accountId}
GET    /api/mail/accounts/{accountId}/capabilities
```

Cross-user references fail closed with the same not-found state used for absent records. Public provider-account representations do not expose the internal GoreeCloud owning-user identifier.

The current router and account registry are development foundations only. Production deployment requires approved persistent storage, bounded request parsing, CSRF/session protections appropriate to the chosen framework, rate limiting where required, and integration with the production GoreeCloud Identity/session boundary.

## Account-Scoped Provider Routing

Provider-dependent operations are addressed through the opaque GoreeCloud provider account, not through a browser-selected provider brand.

The normalized route direction is:

```text
/api/mail/accounts/{accountId}/...
```

The client `GatewayMailProvider` therefore carries an `accountId` rather than a `providerId`. Gmail and IMAP/SMTP browser wrappers also carry only the opaque account authority. The trusted backend resolves the account, verifies user ownership, reads the stored provider type, checks authorization/capabilities, and only then invokes the appropriate provider implementation.

This prevents a caller from converting an authorized account into a different provider simply by changing a path from `gmail` to another provider name. Provider-native identifiers are never substitutes for the opaque GoreeCloud account boundary.

## Provider Capability Discovery

Provider-dependent feature availability is account-specific and authorization-specific. It must not be inferred from provider brand alone.

`ProviderAccountService.capabilities()` performs the following sequence:

1. derive the GoreeCloud user from trusted session state;
2. resolve the opaque provider account through the user-scoped account registry;
3. only after ownership succeeds, call the trusted capability resolver;
4. normalize the result through the shared Courier capability vocabulary;
5. expose only the account ID, provider type, and normalized capability booleans.

Two accounts at the same provider may return different capabilities because scopes, account type, organization policy, provider configuration, or provider rollout state can differ. When no trusted resolver is configured, the result fails closed to an all-false capability set.

Cross-user capability discovery fails before the resolver executes. Browser-supplied capability objects are not authoritative.

The canonical runtime vocabulary and fail-closed helpers are defined in `web/mail-provider.js`; the machine-readable contract is `contracts/courier.provider-capabilities.json`; detailed rules are in `docs/provider-capability-contract.md`.

## Normalized Provider Operations

The shared MailProvider client contract includes:

- `authenticate`
- `listMailboxes`
- `listMessages`
- `getMessage`
- `search`
- `send`
- `createDraft`
- `updateDraft`
- `move`
- `archive`
- `remove`
- `flag`
- `sync`
- `capabilities`

Future trusted backend routes for these operations must remain account-scoped. Unsupported provider-dependent operations must be rejected explicitly rather than inferred from generic transport errors or simulated as successful.

GoreeCloud-native functionality may operate independently when it does not mutate or claim provider-owned state. Provider-dependent operations must require the applicable normalized capability before execution.

## Authorization State

Provider authorization state belongs in trusted server-side storage.

For Gmail, the intended flow is authorization code with PKCE. The backend creates short-lived authorization state, validates callback state and redirect target, exchanges the authorization code with Google, and stores reusable provider credentials only in approved secret storage.

The current Gmail OAuth source can generate PKCE S256 verifier/challenge pairs, construct the Google authorization request, and construct an authorization-code token-exchange request body. It does not perform a production authorization-code exchange and contains no production OAuth secret or provider token.

Microsoft Outlook-compatible, Yahoo, and future provider adapters should use modern delegated authorization where available. Standards-based IMAP/SMTP accounts may use provider-supported OAuth or, only where required and permitted, application/mailbox passwords. Reusable values are never returned by provider-account APIs after enrollment.

## Credential-Vault Boundary

Reusable provider credentials are separate from provider-account metadata. The credential vault is addressed only with both the authenticated GoreeCloud user scope and opaque GoreeCloud provider-account identifier.

The source foundation includes both development semantics and an encrypted-file adapter. Required invariants include:

- secrets are scoped by user and account;
- reads return isolated copies rather than mutable internal references;
- public credential descriptors expose configuration state but not secret values;
- cross-user lookups fail as not found;
- removal invalidates subsequent reads;
- reusable provider secrets do not enter ordinary SQLite application tables;
- encryption keys remain separate from encrypted credential-vault files.

Production acceptance still requires approved target-host key custody, ownership/permissions, rotation and rollback procedure, compromise response, backup/recovery policy, and operational validation.

## Gmail Token Lifecycle

The trusted backend includes a Gmail token lifecycle service. It reuses an access token only while it remains valid beyond a safety skew, refreshes expired access tokens using the stored refresh credential, preserves an existing refresh token when Google does not return a replacement, updates expiration metadata, and normalizes refresh failures before they reach higher layers.

Revocation can attempt upstream Google token revocation before local credential removal. The refresh token is preferred when present, with the access token used only as a fallback. If upstream revocation fails, local credential state is retained so the operation can be retried deliberately instead of silently reporting success. A local-only revocation path remains available for already-invalid or administratively cleared provider credentials.

The token lifecycle service never accepts a browser-supplied bearer token as authorization for mailbox operations.

## Gmail Normalization Foundation

Gmail-native message and label records must be normalized before they enter shared client logic. The development normalizer maps synthetic Gmail metadata into provider-independent identifiers, thread identifiers, subject, sender, recipients, date, snippet, unread/starred state, labels, estimated size, and attachment-presence fields.

Missing provider values remain absent or null rather than being invented. Message bodies, HTML, MIME parts, attachment bytes, and synchronization history remain untrusted provider input and require their own bounded processing.

## Gmail Transport Boundary

The trusted backend includes a Gmail API client foundation that accepts a server-side token resolver rather than a browser-provided bearer token. Source foundations cover label listing, bounded message-reference listing, full-message retrieval, attachment retrieval, normalized errors, and account-ownership enforcement using injected synthetic provider responses.

Bearer authorization is attached only inside trusted transport requests. Access tokens are not included in normalized labels, message references, messages, attachment descriptors, or public error bodies.

A Gmail account service sits in front of Gmail transport. It derives the user from trusted session state, resolves the opaque provider account through the user-scoped account service, verifies that the stored account is a Gmail account, and only then invokes Gmail transport. Cross-user and wrong-provider account references fail before a Gmail API client is used.

The current Gmail transport remains a development foundation. No real Gmail mailbox is production-connected by this contract.

## Provider Request Policy

Provider requests use bounded transport behavior:

- finite per-attempt timeouts;
- finite retry counts;
- capped exponential backoff;
- capped `Retry-After` handling;
- no retries for authentication failures;
- bounded normalization of temporary provider and rate-limit failures.

Production observability must preserve these states without logging reusable credentials or unnecessary message content.

## Synchronization-State Boundary

Synchronization cursors and mailbox synchronization status are account-scoped application state, not provider credentials.

Cursor records are scoped by GoreeCloud user, provider account, and cursor type. Mailbox state is scoped by GoreeCloud user, provider account, and mailbox identifier. Public records omit the owning user identifier. Failed attempts preserve the last successful synchronization time, while a later successful synchronization clears stale error state.

Production synchronization persistence must provide transactional updates, durable recovery, account-isolated lookups, provider-appropriate cursor monotonicity rules, and idempotent replay behavior for queued operations.

## Operation-Idempotency Boundary

Potentially repeated or destructive backend operations require stable idempotency semantics before production synchronization and offline replay are enabled.

Idempotency records are scoped by GoreeCloud user, provider account, normalized operation, and idempotency key. The same key may be reused only when the request fingerprint matches the original operation. Incompatible reuse fails with a conflict. Completed results are copied before exposure, failed operations retain only bounded error codes, and cross-user lookups fail closed.

Production begin/commit/fail transitions must be transactionally coupled to the state mutation they protect and must not persist private message bodies or secret material merely for idempotency.

## Attachment Boundary

Provider attachments remain untrusted. Existing source foundations provide byte inspection, bounded streamed private storage, user/account ownership metadata, expiry/cleanup, Wardveil Scan enforcement, exact SHA-256 content binding, and minimized durable clean-scan provenance.

Provider attachment bytes must not become downloadable merely because the UI displays a security state. The trusted delivery path requires current authoritative Wardveil evidence and rechecks ownership, evidence validity, and content binding before delivery.

Attachment state does not grant mailbox or provider authority beyond the configured provider account.

## Account Isolation

All account, mailbox, message, attachment, draft, synchronization, idempotency, capability, and credential lookups must include the authenticated GoreeCloud user scope at the trusted boundary. Provider-native identifiers are not globally trusted identifiers.

Cross-account and cross-user object references fail closed. The backend must not reveal whether an inaccessible object exists for another user.

## Logging and Observability

Routine logs may contain request correlation identifiers, provider type, opaque provider-account identifier where policy permits, normalized operation, coarse outcome, duration, and safe error classification.

Routine logs must not contain:

- access or refresh tokens;
- passwords or application passwords;
- authorization codes or PKCE verifier secrets;
- session cookies;
- private cryptographic keys;
- complete message bodies;
- attachment contents;
- unnecessary recipient lists or subject text.

Provider errors are translated to bounded GoreeCloud Mail errors before reaching clients.

## Message-Content Boundary

Provider responses and message content remain untrusted after successful authentication. The message-content policy defines a fail-closed rendering boundary: plain text is HTML-escaped and HTML is refused unless an approved sanitizer implementation is explicitly injected.

Defense-in-depth checks reject obviously active markup, event-handler attributes, and active URL schemes before and after sanitizer execution. These checks are not represented as a standalone production sanitizer.

Sanitized HTML still has remote content disabled by default. Privacy Shield governs deliberate remote-resource loading and tracking protection. Attachments remain inert data until explicitly handled through approved paths.

## Persistence Direction

The external provider remains authoritative for mailbox state. GoreeCloud Mail may persist normalized metadata, synchronization cursors, search indexes, offline/cache records, attachment metadata, notification state, rules, preferences, and other GoreeCloud-owned application state subject to retention, encryption, authorization, and deletion requirements.

`docs/persistence-schema.sql` and repository-owned migrations define the current durable application-state foundation. Reusable provider secrets remain outside ordinary application tables; only credential-vault references may be persisted there.

Production storage must preserve user/account isolation, enforce referential integrity, support recovery and migration, and maintain explicit separation between provider-authoritative mailbox state and GoreeCloud-owned cached/application state.

## Mail-Server Boundary

There are no current plans for GoreeCloud Mail to host mailboxes, operate MX records, receive Internet email as a GoreeCloud provider, deliver Internet email through GoreeCloud-owned outbound mail infrastructure, or operate provider-scale sender reputation, deliverability, abuse, and support systems.

Self-hosting GoreeCloud Mail means self-hosting this application and trusted backend. It does not convert the backend into an Internet email server.

Any future decision to operate a GoreeCloud email provider requires a separate explicit architecture decision. No provider-account route, capability, adapter, cache, synchronization service, or trusted-backend component in the current architecture should be interpreted as dormant mail-server authority.

## Acceptance Requirements

Real-provider production connectivity is not accepted until tests and deployed evidence prove at minimum:

1. authorization state cannot be replayed or redirected to an unapproved target;
2. reusable credentials never appear in browser-visible responses or routine logs;
3. one GoreeCloud user cannot address another user's provider account, capabilities, messages, cached objects, or attachments;
4. provider errors are normalized without leaking credentials or sensitive protocol details;
5. HTML and remote-content controls remain enforced on real provider data;
6. account revocation removes or invalidates reusable provider authorization state correctly;
7. synchronization resumes safely without duplicating destructive operations;
8. provider-account API routing cannot override session-derived user ownership;
9. provider payloads are normalized without inventing missing data or passing unsafe provider content directly into shared rendering paths;
10. provider credentials remain isolated in the credential-vault boundary and cannot be retrieved by another user;
11. trusted transports never return bearer tokens or raw upstream error bodies to client-facing code;
12. provider transport cannot run for an account owned by another user or through the wrong provider adapter;
13. expired access tokens are refreshed server-side where supported without exposing refresh credentials to clients;
14. durable state stores vault references rather than reusable provider secrets;
15. upstream provider revocation failures do not silently erase the only local retry state;
16. provider transport applies finite timeout/retry/backoff behavior and does not retry authentication failures;
17. synchronization cursors and mailbox state remain isolated by user and provider account;
18. repeated operations cannot reuse an idempotency key with incompatible input;
19. operation-idempotency transitions are transactionally coupled to protected production state changes;
20. message HTML cannot render without the approved sanitizer and remote resources remain blocked by default;
21. provider capabilities are resolved from the trusted account after ownership checks and unsupported operations fail closed;
22. two accounts at the same provider may expose different capability sets without cross-account leakage;
23. browser routes use opaque provider-account authority rather than provider-name authority;
24. real Gmail, Microsoft Outlook-compatible, Yahoo, and standards-based IMAP/SMTP integrations are independently validated for the capabilities they claim;
25. the deployed system continues to preserve the explicit client-only Mail-server boundary.
