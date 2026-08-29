# Gmail Send and Draft Transport

## Purpose

This document defines the current source-level GoreeCloud Mail foundation for Gmail message sending and draft creation/update through the trusted provider backend.

This is an external-provider client capability. Gmail remains authoritative for mailbox hosting and Internet mail delivery. Nothing in this transport makes GoreeCloud Mail an SMTP provider, MX service, hosted mailbox provider, or sender-reputation operator.

## Provider API Contract

The implementation follows the Gmail API resource contract:

- send message: `POST /gmail/v1/users/me/messages/send` with a `Message` containing base64url `raw` RFC-formatted mail;
- create draft: `POST /gmail/v1/users/me/drafts` with a `Draft` containing `message.raw`;
- update draft: `PUT /gmail/v1/users/me/drafts/{draftId}` with replacement `message.raw`.

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

The current native message builder deliberately supports a bounded plain-text foundation rather than pretending to provide the full composer feature set.

Current controls include:

- at least one recipient required;
- bounded recipient count;
- simple mailbox-address validation for To/Cc/Bcc and any trusted From/Reply-To value;
- CR, LF, and NUL rejection in header values;
- bounded subject/header sizes;
- bounded UTF-8 body size;
- RFC-style CRLF normalization;
- UTF-8 encoded-word handling for non-ASCII subjects;
- MIME version, text/plain UTF-8 content type, and 8bit transfer encoding;
- base64url conversion for Gmail `raw` transport.

Rich HTML composition, attachments in outgoing messages, multipart MIME construction, signatures, inline images, templates, and advanced identity presentation remain separate implementation milestones.

## Sender Identity Boundary

A caller-supplied `From` value is not trusted merely because the account can send mail.

If a caller requests an explicit From identity, `GmailAccountService` additionally requires the `senderIdentities` capability. That capability is not currently established by the Gmail scope resolver, so arbitrary custom From values fail closed before the Gmail client is created or invoked.

Production sender-identity work must bind available From identities to provider-confirmed account/send-as state rather than to browser claims.

## Replay Safety

Read operations may use the existing bounded provider retry policy.

Gmail send, draft create, and draft update are treated as non-replay-safe writes. The Gmail client forces `maxAttempts: 1` even when the surrounding provider request policy is configured for multiple attempts. This avoids automatically repeating a write after an ambiguous timeout, rate-limit, or upstream failure.

This does not solve write reconciliation. A later milestone must define idempotency/reconciliation behavior for ambiguous send outcomes and offline replay before those workflows are production-accepted.

## Current Acceptance Boundary

This milestone is source-development work using injected/synthetic Gmail responses. It does not establish:

- a real Google account authorization;
- a real send or draft against Gmail;
- production OAuth consent/verification acceptance;
- production credential-key custody;
- sender-identity/send-as acceptance;
- rich MIME or outgoing attachment support;
- write idempotency/reconciliation acceptance;
- production observability or rate-limit behavior;
- production deployment.

All such claims require separate evidence and acceptance.
