# Courier Provider Interface Contracts

## Purpose

Defines the contract between Courier Core and compatible external email providers.

Courier Core must not depend on Gmail, Microsoft Outlook, Yahoo Mail, IMAP, SMTP, or any single provider implementation. Provider-specific behavior stays behind normalized adapters while the configured external provider remains authoritative for mailbox hosting and Internet mail transport.

The machine-readable capability vocabulary is stored in `contracts/courier.provider-capabilities.json` and is implemented by `web/mail-provider.js`.

## Provider Adapter

Each provider adapter is responsible for the provider operations it actually supports, including as applicable:

- authentication and authorization;
- mailbox discovery and message reading;
- attachment retrieval;
- incremental or push-assisted synchronization;
- message mutation;
- sending and drafts;
- provider search;
- provider identities, aliases, domains, rules, quota, retention, and organization features;
- provider-specific capability discovery;
- provider-specific error translation.

Adapters must not claim unsupported operations merely because another provider exposes them.

## MailProvider Interface

The current shared client contract requires:

```text
authenticate()
listMailboxes()
listMessages()
getMessage()
search()
send()
createDraft()
updateDraft()
move()
archive()
remove()
flag()
sync()
capabilities()
```

Individual required methods may still fail with a normalized unsupported/provider-capability result when an adapter cannot perform the operation for the selected account. The `capabilities()` response is the authoritative feature-gating input for provider-dependent UI and workflows.

## Provider Capability Contract

Provider capabilities are explicit booleans. Missing values normalize to `false`; unknown values are ignored. This prevents accidental feature enablement when a provider contract changes or a provider exposes only a subset of Mail operations.

Current capability vocabulary:

- `mailboxAccess`
- `messageRead`
- `attachmentRetrieval`
- `archive`
- `drafts`
- `flags`
- `folders`
- `labels`
- `search`
- `send`
- `threads`
- `move`
- `delete`
- `readState`
- `spam`
- `trashRecovery`
- `serverSideSearch`
- `incrementalSync`
- `pushSync`
- `storageQuota`
- `scheduledSend`
- `undoSend`
- `deliveryReceipts`
- `readReceipts`
- `senderIdentities`
- `aliases`
- `customDomains`
- `distributionLists`
- `providerRules`
- `retentionControls`
- `organizationPolicies`

`supportsMailProviderCapability()` may be used for presentation decisions. `requireMailProviderCapability()` is the fail-closed guard for provider-dependent actions and throws `ProviderCapabilityUnavailableError` when authority is unavailable.

Capability declarations must reflect the configured account and authorized provider scopes, not just a provider brand. For example, two accounts at the same provider can have different mailbox access, push synchronization, aliases, organization administration, or retention capabilities.

## Account-Scoped Authority

The browser gateway carries an opaque GoreeCloud provider-account ID and uses `/api/mail/accounts/{accountId}/...` routes. It does not select provider authority by placing `gmail`, `imap-smtp`, `outlook`, `yahoo`, or another provider name in the route.

The trusted backend derives the GoreeCloud user from session state, resolves the stored provider account, verifies ownership, determines the stored provider implementation, resolves account-specific capabilities, and only then may provider transport run.

Capability discovery is exposed at:

```text
GET /api/mail/accounts/{accountId}/capabilities
```

An unconfigured trusted capability resolver returns an all-false set. Cross-user account references fail before capability resolution.

## GoreeCloud-Native vs Provider-Dependent Features

GoreeCloud-native features do not need a provider capability when they operate wholly inside the GoreeCloud-controlled client/backend boundary. Examples may include local organization views, Privacy Shield remote-content policy, Wardveil attachment enforcement, client-side writing assistance, local reminders, and cross-application workflows.

A GoreeCloud feature **does** require provider capability when completing the workflow reads, mutates, or claims provider-authoritative state. Examples include reading a mailbox (`mailboxAccess`), retrieving provider attachments (`attachmentRetrieval`), sending (`send`), provider-side scheduled send (`scheduledSend`), provider aliases (`aliases`), custom-domain administration (`customDomains`), quota reporting (`storageQuota`), provider filtering/rules (`providerRules`), retention controls (`retentionControls`), or organization policy (`organizationPolicies`).

The product must not infer provider authority from the existence of a GoreeCloud-native UI feature.

## Mail-Server Boundary

Provider capabilities must never include or imply GoreeCloud mailbox hosting, MX operation, inbound Internet mail reception, GoreeCloud outbound Internet mail delivery, sender-reputation operation, or other provider-scale mail-server authority.

Self-hosted GoreeCloud Mail means the application and trusted backend are self-hosted. External providers remain authoritative for the Internet mailbox and mail transport under the current architecture.

## Authentication Boundary

Provider authentication must be isolated.

Supported directions include:

- OAuth where supported;
- application passwords where a provider requires them and policy permits their use;
- provider-specific delegated authentication where approved.

Rules:

- credentials are never committed to source control;
- reusable tokens and passwords remain behind approved secure credential storage;
- browser clients do not receive long-lived provider secrets;
- logs must never contain secrets.

## Provider Directions

### Gmail

The repository contains Gmail OAuth/token/API foundations and synthetic provider validation. Real-provider production acceptance remains separate.

### Microsoft Outlook / Microsoft mail services

A dedicated adapter may use approved modern Microsoft provider interfaces where appropriate. Microsoft-specific concepts must normalize into Courier contracts rather than leaking into Courier Core.

### Yahoo Mail

Yahoo support may use approved provider interfaces or standards-based IMAP/SMTP where supported and authorized.

### Standards-based IMAP / SMTP

The standards adapter direction provides mailbox access and sending for compatible providers while preserving provider capability detection. IMAP/SMTP availability does not imply that every higher-level feature such as provider-side scheduled send, labels, push synchronization, aliases, organization policies, or custom-domain administration is available.

## Error Model

Provider errors must be normalized into bounded Courier states, including as applicable:

- `authentication_required`
- `authorization_expired`
- `provider_unavailable`
- `network_failure`
- `rate_limited`
- `invalid_message`
- `provider-capability-unavailable`

Errors must not disclose reusable credentials, provider tokens, unnecessary message content, or unrelated account information.

## Expansion Goal

New providers should be added through adapters and account-specific capability declarations rather than by modifying Courier Core around provider-specific assumptions.
