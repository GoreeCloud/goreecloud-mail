# Courier Provider Capability Contract

## Purpose

This contract defines how GoreeCloud Mail decides whether a provider-dependent action is available for a configured external email account and how the trusted backend enforces that decision before provider transport runs.

GoreeCloud Mail is a client platform. The configured provider remains authoritative for mailbox hosting and Internet mail transport. Capability discovery exists so GoreeCloud-native workflows can adapt accurately to Gmail, Microsoft Outlook-compatible services, Yahoo Mail, standards-based IMAP/SMTP providers, and future adapters without assuming that every provider exposes the same operations.

## Runtime Sources

- Runtime vocabulary and fail-closed helpers: `web/mail-provider.js`
- Trusted account-scoped resolution and enforcement: `server/provider-account-service.js`
- Trusted capability-discovery and write API routes: `server/mail-api-router.js`
- Provider-independent write dispatch: `server/provider-operation-service.js`
- Gmail execution enforcement: `server/gmail-account-service.js`
- Gmail OAuth-scope resolver: `server/gmail-capability-resolver.js`
- Gmail raw message construction: `server/gmail-message-builder.js`
- Gmail provider transport: `server/gmail-api-client.js`
- External provider resolver dispatcher: `server/provider-capability-resolver.js`
- Machine-readable contract: `contracts/courier.provider-capabilities.json`
- Gmail write safety contract: `docs/gmail-write-transport.md`

## Rules

1. Missing provider capabilities normalize to `false`.
2. Unknown capability names are rejected by runtime gating helpers.
3. Provider-dependent actions must fail closed when required authority is unavailable.
4. Capability availability is account-specific and authorization-specific; it must not be inferred from provider brand alone.
5. GoreeCloud-native features may operate without provider authority only when they do not mutate or claim provider-owned state.
6. Provider capability declarations do not include GoreeCloud mailbox hosting, MX service, inbound Internet mail, GoreeCloud outbound Internet delivery, or sender-reputation operations.
7. Browser callers do not supply authoritative provider capability state. Capability discovery is resolved after trusted session and provider-account ownership checks.
8. A capability shown in the UI is not an authorization boundary by itself. Provider transport must independently require the relevant trusted account capability before execution.
9. Provider OAuth scope is necessary but not sufficient for an effective capability. GoreeCloud Mail must also have the corresponding trusted provider implementation before the capability can become true.
10. Provider writes that are not proven replay-safe must not inherit automatic retry behavior merely because read operations do.

## Trusted Backend Discovery

The trusted API exposes account-scoped discovery through:

```text
GET /api/mail/accounts/{accountId}/capabilities
```

`ProviderAccountService.capabilities()` first derives the GoreeCloud user from trusted session state, then resolves the provider account through the user-scoped registry. Only after ownership succeeds may the injected trusted capability resolver run.

The resolver receives the trusted account record plus the session-derived internal user identifier. Browser-supplied provider names, account identifiers, or capability claims do not override the stored provider-account relationship.

Two accounts using the same provider may return different capability sets because scopes, account type, organization policy, provider configuration, or feature availability can differ. The resolver result is normalized through the shared capability vocabulary before exposure.

When no capability resolver is configured, discovery returns a normalized all-false capability set. Cross-user knowledge of an opaque provider-account identifier does not authorize capability discovery.

## Trusted Execution Enforcement

`ProviderAccountService.requireCapabilities()` resolves the current account capability state and requires every named capability before it returns provider-account authority to a transport service. A missing capability raises the bounded `provider-capability-unavailable` state.

The Gmail account service currently enforces:

- label listing -> `labels`;
- message listing -> `mailboxAccess`;
- full message retrieval -> `messageRead`;
- attachment retrieval -> `mailboxAccess` + `attachmentRetrieval`;
- direct send -> `send`;
- draft create/update -> `drafts`;
- an explicitly caller-requested From identity -> the operation capability plus `senderIdentities`.

Wrong-provider and cross-user checks occur before provider execution. If authority is unavailable, Gmail transport is not invoked.

## Gmail OAuth-Scope Resolution

GoreeCloud Mail derives effective Gmail account capabilities from OAuth scope metadata stored inside the trusted credential-vault boundary.

Effective capability is the intersection of provider authorization and GoreeCloud implementation. At the current source milestone:

- `gmail.modify` or full-mail authorization may establish the implemented read-side capabilities, `send`, and `drafts`;
- `gmail.readonly` may establish read-side capabilities but no writes;
- `gmail.labels` may establish `labels` without mailbox/message/attachment authority;
- `gmail.send` may establish `send` but not `drafts` or mailbox reads;
- `gmail.compose` may establish `send` and `drafts` but does not by itself establish mailbox reads;
- missing credential authorization returns the normalized all-false capability set;
- providers without an implemented provider-specific resolver return the normalized all-false capability set;
- `senderIdentities` remains false until provider-confirmed sender/send-as identity discovery and enforcement is implemented.

The resolver reads credential state only after provider-account ownership succeeds. Cross-user references therefore fail before another user's OAuth scope metadata can influence capability state.

## Gmail Write Boundary

The generic browser gateway already uses opaque account paths. The trusted router now maps the corresponding write operations through `ProviderOperationService`:

```text
POST /api/mail/accounts/{accountId}/messages
POST /api/mail/accounts/{accountId}/drafts
PUT  /api/mail/accounts/{accountId}/drafts/{draftId}
```

The Gmail implementation converts bounded plain-text message input into base64url RFC-formatted `raw` content and calls the Gmail API `messages.send`, `drafts.create`, or `drafts.update` resource operation.

Send/draft writes force one provider request attempt even when the shared provider request policy is configured for multiple retries. Ambiguous write reconciliation remains a future milestone.

## Future Provider Adapters

Each provider adapter should map its real authorized account features into the shared capability vocabulary and enforce those capabilities again before transport. Provider-specific concepts may remain inside the adapter, but Courier Core should consume normalized capability names only.

Source-level capability discovery and execution do not establish real-provider or production acceptance. Real provider credentials, live mailbox behavior, production secret custody, sender identities, ambiguous-write recovery, observability, and deployment require separate evidence.
