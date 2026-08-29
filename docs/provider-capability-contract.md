# Courier Provider Capability Contract

## Purpose

This contract defines how GoreeCloud Mail decides whether a provider-dependent action is available for a configured external email account and how the trusted backend enforces that decision before provider transport runs.

GoreeCloud Mail is a client platform. The configured provider remains authoritative for mailbox hosting and Internet mail transport. Capability discovery exists so GoreeCloud-native workflows can adapt accurately to Gmail, Microsoft Outlook-compatible services, Yahoo Mail, standards-based IMAP/SMTP providers, and future adapters without assuming that every provider exposes the same operations.

## Runtime Sources

- Runtime vocabulary and fail-closed helpers: `web/mail-provider.js`
- Trusted account-scoped resolution and enforcement: `server/provider-account-service.js`
- Trusted capability-discovery API route: `server/mail-api-router.js`
- Gmail execution enforcement: `server/gmail-account-service.js`
- Machine-readable contract: `contracts/courier.provider-capabilities.json`
- Provider interface rules: `docs/provider-interface-contracts.md`

## Rules

1. Missing provider capabilities normalize to `false`.
2. Unknown capability names are rejected by runtime gating helpers.
3. Provider-dependent actions must fail closed when required authority is unavailable.
4. Capability availability is account-specific and authorization-specific; it must not be inferred from provider brand alone.
5. GoreeCloud-native features may operate without provider authority only when they do not mutate or claim provider-owned state.
6. Provider capability declarations do not include GoreeCloud mailbox hosting, MX service, inbound Internet mail, GoreeCloud outbound Internet delivery, or sender-reputation operations.
7. Browser callers do not supply authoritative provider capability state. Capability discovery is resolved after trusted session and provider-account ownership checks.
8. A capability shown in the UI is not an authorization boundary by itself. Provider transport must independently require the relevant trusted account capability before execution.

## Trusted Backend Discovery

The trusted API exposes account-scoped discovery through:

```text
GET /api/mail/accounts/{accountId}/capabilities
```

`ProviderAccountService.capabilities()` first derives the GoreeCloud user from trusted session state, then resolves the provider account through the user-scoped registry. Only after ownership succeeds may the injected trusted capability resolver run.

The resolver receives the trusted account record plus the session-derived internal user identifier. Browser-supplied provider names, account identifiers, or capability claims do not override the stored provider-account relationship.

Two accounts using the same provider may return different capability sets because scopes, account type, organization policy, provider configuration, or feature availability can differ. The resolver result is normalized through the shared capability vocabulary before exposure.

When no capability resolver is configured, discovery returns a normalized all-false capability set. This is intentional fail-closed behavior and does not imply that the provider lacks the feature universally; it means the current trusted backend has not established authority for that account.

Cross-user knowledge of an opaque provider-account identifier does not authorize capability discovery. Ownership failure returns the same provider-account-not-found boundary and occurs before the provider resolver is called.

## Trusted Execution Enforcement

`ProviderAccountService.requireCapabilities()` resolves the current account capability state once and requires every named capability before it returns provider-account authority to a transport service. A missing capability raises the bounded `ProviderCapabilityUnavailableError` with `provider-capability-unavailable`, HTTP status 400, the required capability, and opaque account context.

The Gmail account service now applies this enforcement before creating or invoking Gmail transport:

- label listing requires `mailboxAccess` and `labels`;
- message listing requires `mailboxAccess`;
- full message retrieval requires `messageRead`;
- attachment retrieval requires `mailboxAccess` and `attachmentRetrieval`.

Wrong-provider and cross-user checks occur before provider capability execution. If a capability is unavailable, the Gmail transport factory is not called.

Future Microsoft, Yahoo, and IMAP/SMTP execution services should apply the same pattern with the specific capabilities required by each normalized operation.

## Feature-Gating Examples

A local reminder, Wardveil attachment decision, Privacy Shield remote-content control, or client-side writing tool can be available without a provider-specific capability when it operates entirely inside the GoreeCloud-controlled boundary.

A scheduled-send button that depends on provider-side scheduling must require `scheduledSend`. A custom-domain administration surface must require `customDomains`. Organization retention controls must require `retentionControls`. Unsupported actions should be hidden or clearly unavailable and must never be represented as completed successfully.

UI feature gating improves usability, but the trusted backend remains the enforcement authority for any action that requires provider state or transport.

## Future Provider Adapters

Each provider adapter should map its real authorized account features into the shared capability vocabulary. Provider-specific concepts may remain inside the adapter, but Courier Core should consume normalized capability names only.

Provider capability discovery and source-level enforcement are prerequisites to provider-dependent execution; neither is evidence that a real provider connection has been production-accepted.
