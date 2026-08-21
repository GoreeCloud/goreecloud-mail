# GoreeCloud Mail Architecture

## Product boundary

GoreeCloud Mail is a first-party email client. It does not operate an email server, MX service, outbound delivery platform, DKIM infrastructure, or sender-reputation system.

## Initial layers

1. **Client shell** — responsive Glaze UI web experience.
2. **Mail provider contract** — provider-independent operations and capability discovery.
3. **Provider adapters** — Gmail API and IMAP/SMTP implementations in later milestones.
4. **Security and privacy boundary** — Wardveil Security and Privacy Shield controls around untrusted message content, links, attachments, and remote resources.
5. **Suite integrations** — Contacts, Calendar, Tasks, Notes/Memos, Notify, and Identity through documented interfaces.

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

## Data rules

The provider remains authoritative for mailbox state. Local or GoreeCloud-hosted data may cache mailbox content for offline operation, indexing, synchronization, and notifications, but cached state is subordinate unless a future architecture explicitly changes that boundary.

## Client direction

The first implementation target is the web shell. Linux desktop and Android clients will reuse shared product contracts where practical. iOS remains a later target after synchronization, authentication, and provider behavior are stable.

## Security model

Email is hostile input. Production implementations must sanitize HTML, restrict remote content, validate attachment metadata and paths, isolate accounts, protect provider credentials, and prevent sensitive message data from entering routine logs.
