# Courier Provider Adapter Architecture

## Purpose

GoreeCloud Mail uses provider adapters so Courier Core can support compatible external email services without becoming dependent on Gmail, Microsoft, Yahoo, IMAP/SMTP, or any other single provider implementation.

GoreeCloud Mail remains a client platform. External providers remain authoritative for mailbox hosting and Internet mail transport.

## Authority Path

```text
GoreeCloud Mail client
        |
        | opaque provider account ID
        v
Trusted /api/mail/accounts/{accountId}/... boundary
        |
        | session-derived user + stored account + capability checks
        v
Courier provider interface
        |
        +--> Gmail adapter
        +--> Microsoft mail adapter
        +--> Yahoo adapter
        +--> Standards IMAP/SMTP adapter
        +--> Future approved adapters
```

The browser does not choose provider authority by changing a provider name in a route. The trusted backend resolves the opaque account under the authenticated user, determines the stored provider implementation, evaluates account-specific authorized capabilities, and then invokes the correct adapter.

## Adapter Responsibilities

A provider adapter handles, where supported and authorized:

- provider authentication and delegated authorization;
- mailbox/folder/label discovery;
- message listing and retrieval;
- attachment retrieval;
- draft creation and update;
- message submission;
- message state mutation;
- provider/server-side search;
- incremental or push-assisted synchronization;
- provider identities and aliases;
- provider-specific rules, quota, retention, domain, distribution-list, and organization capabilities;
- provider-specific error translation;
- capability discovery and mapping into the shared Courier vocabulary.

Adapters must report only capabilities established for the configured account. Provider brand alone is not proof of account authority.

## Non-Responsibilities

Provider adapters do not own:

- GoreeCloud Mail user-interface design;
- Glaze UI governance;
- Wardveil Security decisions or protection claims;
- Privacy Shield policy;
- GoreeCloud Identity authentication/authorization policy;
- GoreeCloud Mesh coordination policy;
- reusable credential storage policy;
- message HTML trust decisions;
- attachment security presentation;
- mailbox hosting or GoreeCloud Internet mail transport.

## Credential Handling

Provider credentials and tokens remain behind the trusted backend and approved credential-vault boundary.

The browser must never directly manage long-lived provider credentials. Adapter transports obtain required provider authorization through trusted server-side services after account ownership has been validated.

## Capability Negotiation

The canonical capability vocabulary is defined in `web/mail-provider.js` and `contracts/courier.provider-capabilities.json`.

Examples include:

- mailbox and message access;
- attachment retrieval;
- folders and labels;
- send/drafts/archive/move/delete/read-state/spam operations;
- provider/server-side search;
- incremental and push-assisted synchronization;
- quota reporting;
- scheduled send and supported receipts;
- sender identities and aliases;
- custom domains and distribution lists;
- provider rules;
- retention and organization policy.

Missing capability values normalize to unavailable. Unsupported operations fail closed. Two accounts at the same provider may expose different capability sets.

## Provider Directions

### Gmail

Current source foundations include Gmail OAuth/PKCE construction, token lifecycle, account ownership enforcement, normalized Gmail metadata, bounded API transport, message/label retrieval foundations, attachment retrieval, and synthetic tests.

Real Gmail production connectivity remains separately unaccepted.

### Microsoft Outlook / Microsoft Mail Services

A dedicated Microsoft adapter is a target. It should use approved modern Microsoft provider interfaces and delegated authorization where appropriate, while translating Microsoft-specific folders, categories, identities, search, synchronization, organization, and other capabilities into Courier contracts.

No real Microsoft mailbox connection is claimed by this architecture document.

### Yahoo Mail

Yahoo support is a target through approved provider interfaces and/or standards-based protocols where supported. Yahoo-specific behavior must remain inside its adapter or compatibility layer.

No real Yahoo mailbox connection is claimed by this architecture document.

### Standards-Based IMAP / SMTP

The standards adapter direction provides mailbox access and message submission for compatible providers. IMAP/SMTP support must remain capability-aware: standards access does not imply availability of provider-side scheduled send, labels, organization controls, custom-domain administration, or other provider-specific features.

Where providers support modern delegated authentication for IMAP/SMTP, that should be preferred. Application/mailbox passwords may be used only where necessary, permitted, and protected by the credential-vault boundary.

## Shared Provider Contract

Courier Core should depend on normalized operations and data models rather than provider-native APIs. Provider-specific identifiers may be preserved as opaque adapter metadata when required, but they must not become globally trusted GoreeCloud object identifiers.

The current browser-side MailProvider interface covers authentication, mailboxes, messages, search, send, drafts, move, archive, remove, flag, sync, and capability discovery. Future backend execution for those operations follows the account-scoped `/api/mail/accounts/{accountId}/...` route model.

## Mail-Server Boundary

Provider adapters do not create a GoreeCloud mail provider. They do not authorize GoreeCloud mailbox hosting, MX records, inbound Internet SMTP, GoreeCloud outbound Internet delivery, sender-reputation operations, or provider-scale abuse/support infrastructure.

Self-hosted GoreeCloud Mail means self-hosting the client application and trusted backend. The configured external email service remains the Internet mailbox and transport authority.

## Future Expansion

Additional providers should be added by implementing adapters and mapping real account capabilities into the shared contract, not by changing Courier Core around provider-specific assumptions.

A future decision to build a GoreeCloud-operated email provider would require a separate explicit architecture decision and must not be inferred from this adapter framework.
