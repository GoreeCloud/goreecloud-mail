# GoreeCloud Mail — Specifications

## Status

GoreeCloud Mail is in active development. The product scope is a first-party GoreeCloud email and communication platform with both GoreeCloud-hosted mail-service capabilities and external-provider interoperability.

The current source tree contains a substantial provider/client, persistence, attachment-security, Privacy Shield, and Wardveil foundation. **GoreeCloud-hosted mailbox service, MX operation, inbound/outbound production mail transport, custom-domain hosting, and the complete feature target are not production-accepted by this document.**

## Product definition

GoreeCloud Mail is GoreeCloud's native email and communication platform. It is intended to provide a complete personal, professional, organizational, privacy-preserving, and secure mail experience across supported GoreeCloud clients while also serving as an integrated communication layer for the wider GoreeCloud platform.

GoreeCloud Courier is the unified first-party mail technology and feature framework powering GoreeCloud Mail. Courier is not a separate application or repository.

## Operating modes

### GoreeCloud-hosted service mode

The approved product target includes first-party GoreeCloud capabilities for mailbox hosting, inbound mail processing, outbound mail delivery, account and alias management, custom domains, retention and organization policy, protected storage, administrative controls, and related service functions.

Each hosted capability remains unavailable for production claims until its implementation, deployment, security, privacy, continuity, operational, standards, and deliverability acceptance is complete.

### External-provider interoperability mode

GoreeCloud Mail continues to support compatible external mail providers through normalized provider contracts. Existing Gmail API and IMAP/SMTP foundations belong to this mode.

External providers remain authoritative for provider-owned mailboxes and transport when an account is configured in this mode. GoreeCloud Mail must not claim provider authority it does not possess.

### Mode isolation

Hosted and external-provider authority must remain explicit. A hosted-only action must fail closed on an external-provider account unless an equivalent provider capability is explicitly exposed by the relevant adapter. Account records must identify which mode supplies mailbox and transport authority.

## Native development requirement

GoreeCloud Mail is original GoreeCloud-owned software built natively from the ground up. Narrow mature dependencies may be used only when independently recreating a critical protocol, cryptographic, codec, standards, rendering, operating-system, or interoperability primitive would materially increase risk.

Third-party dependencies do not become the product architecture, interface, brand, workflow authority, or general application logic.

## Required platform systems

Stable qualification requires current approved integration with all of the following:

- **Glaze UI / Design Center** — interface design, interaction, accessibility, responsiveness, and design-system governance.
- **Wardveil Security / Security Center** — protection, detection, trust, verification, response, attachment scanning, malicious-link handling, authentication warnings, and evidence-backed protection states.
- **Privacy Shield / Privacy Center** — privacy, consent, data minimization, data governance, user control, remote-content privacy, tracking protection, and privacy contracts.
- **Everkeep / Continuity Center** — resilience, backup, recovery, preservation, portability, succession, and continuity.
- **GoreeCloud Identity / Identity Center** — GoreeCloud authentication, authorization, accounts, identities, devices, credentials, sessions, aliases, recovery, and delegated authority.
- **GoreeCloud Mesh / Mesh Center** — authenticated service coordination, governance, capabilities, events, and policy-controlled integration.

Mail also integrates with applicable first-party services including GoreeCloud Sync, Drive, Location, Backups, Contacts, Calendar, Tasks, Notes/Memos, Notify, Search, and future approved GoreeCloud systems.

## Core product capability domains

The authoritative feature target includes:

1. Core email and inbox management.
2. Organization, labels, categories, priority, and focused/split inbox experiences.
3. Advanced, server-side, saved, smart-folder, and natural-language search and discovery.
4. Rules, filtering, unsubscribe, automated cleanup, categorization, and plain-language automation.
5. Snooze, reminders, follow-up, awaiting-reply, reply-queue, inbox-zero, unwanted-mail, and cleanup workflows.
6. Rich/plain composition, attachments, inline media, identities, aliases, signatures, groups, templates, snippets, and placeholders.
7. Scheduled send, undo send, delivery timing, supported receipts, and supported open/read state.
8. Spell/grammar checking, predictive writing, smart replies, generation, rewriting, tone control, shortening, expansion, and context-aware drafting.
9. Summaries, digests, intelligent priority/sender classification, meeting/calendar context, attachment filing, newsletter management, mailbox insights, and storage insights.
10. End-to-end encrypted mail, zero-access protected mailbox storage where architecturally applicable, OpenPGP, PGP/MIME, S/MIME, digital signatures, encrypted drafts/attachments, protected subjects where supported, Autocrypt, client-side encryption, and TLS transport.
11. Wardveil-backed phishing, spam, suspicious-link, malicious-attachment, suspicious-sender, authentication, and account-security protection.
12. IP/tracking protection, private remote-content loading, tracking-pixel blocking, protected-message expiry/revocation/restrictions, disposable/private/multiple aliases, and custom domains.
13. Security-event history, notifications, interoperability, private/self-hosted deployment, organization policy, retention, and administration.
14. Deep GoreeCloud integration and platform-service interoperability.

See [FEATURES.md](FEATURES.md) for the repository capability inventory.

## Current source-validated foundation

At the August 29, 2026 scope-expansion milestone, the repository already contains source-level foundations for:

- responsive Glaze UI web shell and mail reader;
- provider-independent mail contracts and same-origin gateway boundaries;
- Gmail and IMAP/SMTP adapter foundations using synthetic provider validation;
- trusted session-derived user identity and provider-account isolation;
- OAuth state, PKCE construction, token lifecycle, credential-vault boundaries, and encrypted credential persistence;
- bounded provider timeout/retry/rate-limit behavior;
- durable SQLite application state, migrations, backup/integrity verification, synchronization cursors, and operation idempotency;
- fail-closed HTML rendering policy pending a production sanitizer;
- Privacy Shield remote-content defaults;
- hardened attachment byte inspection, private storage, ownership-bound delivery, expiry/cleanup, and durable metadata;
- Wardveil Scan authenticated transport, exact-content binding, fail-closed delivery enforcement, and minimized durable clean-scan provenance;
- a native platform-mode capability contract that distinguishes GoreeCloud-hosted service authority from external-provider authority.

Source validation does not equal production acceptance.

## Security and privacy invariants

- Email, HTML, links, attachments, protocol input, provider input, remote resources, and sender-controlled metadata are untrusted.
- Reusable credentials, encryption keys, signing material, provider tokens, mailbox passwords, and equivalent secrets must not be committed to source or ordinary project documentation.
- Authorization must be enforced at trusted service boundaries, not only in UI filtering.
- Cross-user, cross-account, cross-organization, and cross-mode data leakage must fail closed.
- Protection claims must reflect authoritative Wardveil evidence and must not use absolute language unsupported by evidence.
- Privacy Shield minimization and user-control requirements apply to content, metadata, indexing, telemetry, logs, remote resources, and intelligent-assistance context.
- End-to-end or zero-access claims require an architecture in which the stated infrastructure cannot access the protected content; labels alone are insufficient.
- Hosted mail transport must not be treated as production-ready until abuse handling, anti-spam, authentication, deliverability, reputation, queueing, retry, bounce, TLS, DNS, operational monitoring, and incident-response requirements are accepted.

## Secure-mail architecture requirements

OpenPGP/PGP-MIME, S/MIME, protected external messages, client-side encryption, end-to-end encrypted Mail modes, digital signatures, key/certificate discovery, verification, revocation, recovery, and encrypted drafts/attachments must use explicit cryptographic boundaries and documented key lifecycle.

Secure-mail modes must define what metadata remains observable, including addressing, routing, timing, message size, and any subject/header information that the selected standard cannot conceal.

## Hosted-mail service requirements

Before hosted mode can be production-accepted, the service architecture must define and validate at least:

- account/mailbox lifecycle and quota boundaries;
- domain enrollment, ownership verification, DNS guidance, and key rotation;
- inbound SMTP acceptance, queueing, retry, deduplication, size limits, authentication results, spam/threat processing, and final mailbox commit;
- outbound submission, authorization, DKIM signing, SPF/DMARC alignment strategy, queueing, retries, bounces, feedback, rate controls, and abuse prevention;
- mail storage, indexing, search, retention, deletion, recovery, backup, portability, and continuity;
- aliases, distribution lists, organization policy, audit/event history, and administrative authority;
- encryption at rest and any zero-access/client-side protected storage modes;
- observability that minimizes message-content exposure;
- production disaster recovery and Everkeep treatment;
- interoperability and migration paths.

## Client targets

- Web
- Linux desktop
- Android
- iOS

Client capabilities may advance at different rates, but shared security, privacy, identity, data, and protocol contracts must remain compatible.

## Acceptance model

A feature is considered implemented only when repository evidence exists. A feature is considered source-validated only when its exact revision passes the applicable automated or review gates. A feature is production-accepted only when the deployed runtime and required operational/security/privacy/continuity acceptance evidence are complete.

Documentation must distinguish these states. Planned capability lists are requirements, not implementation claims.

## Documentation set

- [README.md](README.md) — project overview and current status.
- [SPECIFICATIONS.md](SPECIFICATIONS.md) — architecture and product requirements.
- [FEATURES.md](FEATURES.md) — capability inventory and implementation status.
- [BENEFITS.md](BENEFITS.md) — intended user and platform benefits.
- [COMPETITIVE-OBJECTIVES.md](COMPETITIVE-OBJECTIVES.md) — product objectives and differentiation targets without unverified superiority claims.
- [docs/courier.md](docs/courier.md) — Courier identity source-control mirror.
