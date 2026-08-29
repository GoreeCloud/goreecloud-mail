# Gmail Send and Draft Transport

## Purpose

This document defines the current source-level GoreeCloud Mail foundation for Gmail message sending and draft creation/update through the trusted provider backend.

This is an external-provider client capability. Gmail remains authoritative for mailbox hosting and Internet mail delivery. Nothing in this transport makes GoreeCloud Mail an SMTP provider, MX service, hosted mailbox provider, or sender-reputation operator.

## Provider API Contract

The implementation follows the Gmail API resource contract:

- send message: `POST /gmail/v1/users/me/messages/send` with a `Message` containing base64url `raw` RFC-formatted mail;
- create draft: `POST /gmail/v1/users/me/drafts` with a `Draft` containing `message.raw`;
- update draft: `PUT /gmail/v1/users/me/drafts/{draftId}` with replacement `message.raw`;
- bounded draft reconciliation lookup: `GET /gmail/v1/users/me/drafts?q=rfc822msgid:<generated-id>&maxResults=2`.

The Gmail API response is normalized before it leaves trusted provider code. Raw message bodies, bearer tokens, and unrelated upstream response fields are not returned through the normalized write result.

## Authority Chain

The write path is:

```text
browser GatewayMailProvider
  -> /api/mail/accounts/{accountId}/...
  -> Mail API router
  -> ProviderOperationService
  -> owned provider account
  -> GmailAccountService
  -> current trusted account capabilities
  -> bounded RFC message builder
  -> GmailApiClient
  -> Gmail API
```

The browser supplies the opaque GoreeCloud provider-account ID, not authoritative provider identity. Session-derived account ownership is checked before provider dispatch and again inside the Gmail service boundary.

## Effective OAuth Capability

Provider OAuth scope is necessary but not sufficient.

At this milestone:

- `gmail.send` may establish `send` only;
- `gmail.compose` may establish `send` and `drafts`;
- `gmail.modify` and full-mail authorization may establish the implemented read-side capabilities plus `send` and `drafts`;
- `gmail.readonly` cannot establish writes;
- `gmail.labels` cannot establish writes.

A missing credential or unsupported provider still fails closed.

## Message Construction

The current native message builder provides a bounded MIME construction foundation for plain text, sanitized rich HTML alternatives, and explicit outgoing file attachments. It is not a rich editor, attachment-scanning workflow, or provider-delivery acceptance claim.

Current controls include:

- at least one recipient required;
- bounded recipient count;
- simple mailbox-address validation for To/Cc/Bcc and any trusted From/Reply-To value;
- CR, LF, and NUL rejection in header values;
- bounded subject/header sizes;
- independently bounded UTF-8 plain-text and HTML source sizes;
- restrictive first-party HTML sanitization before MIME construction;
- deterministic `multipart/alternative` generation for sanitized HTML plus plain-text fallback;
- optional outgoing attachments supplied as trusted bytes or canonical base64;
- bounded attachment count, per-file size, total attachment size, filename length, and media-type length;
- filename path-separator and header-control rejection;
- simple MIME media-type validation with `application/octet-stream` fallback;
- deterministic `multipart/mixed` generation, with nested `multipart/alternative` when rich HTML is present;
- RFC 2231-style UTF-8 filename parameters with bounded ASCII fallback values;
- 76-character base64 transfer wrapping for attachment payloads;
- RFC-style CRLF normalization;
- UTF-8 encoded-word handling for non-ASCII subjects;
- optional server-owned RFC-style `Message-ID` insertion for reconciliation-enabled send and draft writes;
- MIME version and base64url conversion for Gmail `raw` transport.

Inline images, content-ID relationships, signatures, templates, rich/CSS editor controls, and provider-confirmed attachment behavior remain separate implementation milestones.

Outgoing attachment construction also does **not** bypass the Wardveil Security authority boundary. This builder only constructs MIME from bytes it is given. A production composition pipeline must separately prove how user-selected files are acquired, bounded, authorized, scanned when policy requires it, and admitted to this builder. No Wardveil scan execution is claimed by this source-level MIME milestone.

## Sender Identity Boundary

A caller-supplied `From` value is not trusted merely because the account can send mail.

If a caller requests an explicit From identity, `GmailAccountService` additionally requires the `senderIdentities` capability. That capability is not currently established by the Gmail scope resolver, so arbitrary custom From values fail closed before the Gmail client is created or invoked.

Production sender-identity work must bind available From identities to provider-confirmed account/send-as state rather than to browser claims.

## Replay Safety and Write Reconciliation

Read operations may use the existing bounded provider retry policy.

Gmail send, draft create, and draft update remain non-replay-safe writes. The Gmail client forces `maxAttempts: 1` even when the surrounding provider request policy is configured for multiple attempts. This prevents automatic duplicate writes after an ambiguous timeout, rate-limit, or upstream failure.

Callers may provide a stable `clientMutationId`. Trusted server code combines that opaque value with the owned account ID, hashes the combination with SHA-256, and emits a deterministic `Message-ID` under the reserved non-routable `mail.goreecloud.invalid` domain. The raw client mutation value and account ID are not embedded into the outgoing header.

If Gmail returns an ambiguous temporary/rate-limit/unknown provider failure after the one allowed write attempt, GoreeCloud Mail does **not** replay the write.

### Send reconciliation

For send, the service performs a bounded Gmail search for `in:sent rfc822msgid:<generated-id>`:

- exactly one matching sent message confirms the provider write and returns bounded normalized message metadata with `reconciled: true`;
- zero matches, multiple matches, or a reconciliation-read failure produce `provider-write-outcome-unknown`;
- that outcome is explicitly non-retryable so generic callers do not automatically submit a possibly duplicated message;
- deterministic request failures such as authorization denial do not invoke reconciliation.

### Draft create reconciliation

For draft creation, the service performs a bounded draft search for `rfc822msgid:<generated-id>` with `maxResults=2`:

- exactly one matching draft confirms that the create reached Gmail and returns normalized draft metadata with `reconciled: true`;
- zero matches, multiple matches, or lookup failure produce non-retryable `provider-write-outcome-unknown`;
- the original draft create is never replayed automatically.

### Draft update reconciliation

For draft replacement, the same bounded Message-ID search is used, but a unique Message-ID match is not sufficient by itself. The matching provider draft ID must equal the exact `draftId` supplied to the attempted update. This prevents an unrelated draft carrying the same reconciliation marker from being treated as confirmation of the requested replacement.

If the unique result resolves to a different draft ID, or if no unique result can be confirmed, the operation fails closed as non-retryable `provider-write-outcome-unknown`. The original update is not replayed.

This is a source-level reconciliation foundation, not proof of Gmail search-consistency behavior under real production timing. Offline replay queues, durable cross-process operation journals, and production recovery UX remain separate milestones.

## Current Acceptance Boundary

This milestone remains source-development work using injected/synthetic Gmail responses. It does not establish:

- a real Google account authorization;
- a real send or draft against Gmail;
- production OAuth consent/verification acceptance;
- production credential-key custody;
- sender-identity/send-as acceptance;
- user-facing attachment selection or upload UX;
- Wardveil Security scan execution for outgoing composition;
- provider-confirmed MIME/attachment interoperability or size-limit acceptance;
- inline-image/content-ID support;
- real-provider timing/consistency acceptance for send or draft reconciliation;
- durable offline/cross-process operation-journal acceptance;
- production observability or rate-limit behavior;
- production deployment.

All such claims require separate evidence and acceptance.
