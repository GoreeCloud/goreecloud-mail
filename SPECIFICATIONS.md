# GoreeCloud Mail — Specifications

## Status

GoreeCloud Mail is in active development as a first-party GoreeCloud email client and communication platform experience for compatible external mail providers.

The current source tree contains a substantial provider/client, persistence, attachment-security, Privacy Shield, and Wardveil foundation. **GoreeCloud Mail does not currently plan to operate mailbox hosting, MX infrastructure, inbound SMTP servers, outbound Internet mail-delivery infrastructure, sender-reputation infrastructure, or a GoreeCloud email-provider service.**

A future decision may revisit that boundary, but no hosted GoreeCloud mail-server architecture is part of the current roadmap.

## Product definition

GoreeCloud Mail is GoreeCloud's native email client and communication experience. It is intended to provide a complete personal, professional, organizational, privacy-preserving, and secure email workflow across supported GoreeCloud clients while external providers remain authoritative for mailbox hosting and external mail transport.

GoreeCloud Courier is the unified first-party mail technology and feature framework powering GoreeCloud Mail. Courier is not a separate application, email provider, mail server, or repository.

## Current operating model

GoreeCloud Mail connects to compatible external providers through normalized provider contracts. Target providers include Gmail, Microsoft Outlook and compatible Microsoft mail services, Yahoo Mail, and other providers reachable through approved provider APIs or standards such as IMAP and SMTP.

The provider remains authoritative for the mailbox, message-delivery state, provider folders/labels, quotas, aliases, domain hosting, transport, and provider-side administration except for operations explicitly delegated through an authorized API or protocol.

Self-hosted GoreeCloud Mail deployment means self-hosting the GoreeCloud Mail application and trusted backend. It does **not** mean GoreeCloud Mail hosts the user's Internet mailbox or operates a mail server.

Local or GoreeCloud-controlled caches, indexes, attachment objects, synchronization state, and workflow state are subordinate application data. They must never be represented as a separate authoritative Internet mailbox.

## Native development requirement

GoreeCloud Mail is original GoreeCloud-owned software built natively from the ground up. Narrow mature dependencies may be used only when independently recreating a critical protocol, cryptographic, codec, standards, rendering, operating-system, or interoperability primitive would materially increase risk.

Third-party dependencies do not become the product architecture, interface, brand, workflow authority, or general application logic.

## Required platform systems

Stable qualification requires current approved integration with all of the following:

- **Glaze UI / Design Center** — interface design, interaction, accessibility, responsiveness, and design-system governance.
- **Wardveil Security / Security Center** — protection, detection, trust, verification, response, attachment scanning, malicious-link handling, authentication warnings, and evidence-backed protection states.
- **Privacy Shield / Privacy Center** — privacy, consent, data minimization, data governance, user control, remote-content privacy, tracking protection, and privacy contracts.
- **Everkeep / Continuity Center** — resilience, backup, recovery, preservation, portability, succession, and continuity for GoreeCloud-owned application state.
- **GoreeCloud Identity / Identity Center** — GoreeCloud authentication, authorization, accounts, identities, devices, credentials, sessions, recovery, and delegated authority.
- **GoreeCloud Mesh / Mesh Center** — authenticated service coordination, governance, capabilities, events, and policy-controlled integration.

Mail also integrates with applicable first-party services including GoreeCloud Sync, Drive, Location, Backups, Contacts, Calendar, Tasks, Notes/Memos, Notify, Search, and future approved GoreeCloud systems.

## Core product capability domains

The authoritative feature target includes:

1. Core email and inbox management.
2. Organization, labels, categories, priority, and focused/split inbox experiences.
3. Advanced, provider/server-assisted, saved, smart-folder, and natural-language search and discovery.
4. Rules, filtering, unsubscribe, automated cleanup, categorization, and plain-language automation.
5. Snooze, reminders, follow-up, awaiting-reply, reply-queue, inbox-zero, unwanted-mail, and cleanup workflows.
6. Rich/plain composition, attachments, inline media, identities, provider-supported aliases, signatures, groups, templates, snippets, and placeholders.
7. Scheduled send, undo send, delivery timing, supported receipts, and supported open/read state.
8. Spell/grammar checking, predictive writing, smart replies, generation, rewriting, tone control, shortening, expansion, and context-aware drafting.
9. Summaries, digests, intelligent priority/sender classification, meeting/calendar context, attachment filing, newsletter management, mailbox insights, and storage insights.
10. End-to-end encrypted eligible mail, OpenPGP, PGP/MIME, S/MIME, digital signatures, encrypted drafts/attachments, protected subjects where supported, Autocrypt, client-side encryption, TLS transport, and protected local/cache storage where the architecture actually supports the claim.
11. Wardveil-backed phishing, spam, suspicious-link, malicious-attachment, suspicious-sender, authentication, and account-security protection.
12. IP/tracking protection, private remote-content loading, tracking-pixel blocking, protected-message expiry/revocation/restrictions where enforceable, disposable/private aliases, and provider-supported custom-domain addresses.
13. Security-event history, notifications, interoperability, private/self-hosted application deployment, provider-supported organization policy, retention, and administration.
14. Deep GoreeCloud integration and platform interoperability.

See [FEATURES.md](FEATURES.md) for the repository capability inventory.

## Current source-validated foundation

The repository contains source-level foundations for:

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
- Wardveil Scan authenticated transport, exact-content binding, fail-closed delivery enforcement, and minimized durable clean-scan provenance.

Source validation does not equal production acceptance.

## Provider architecture requirements

Provider-specific implementations must remain behind documented normalized contracts wherever practical. The shared architecture must support capability discovery so GoreeCloud Mail can accurately adapt to different providers rather than assuming every provider behaves like Gmail.

Initial and target provider directions include:

- Gmail through approved Google APIs and OAuth where appropriate;
- Microsoft Outlook and compatible Microsoft mail services through approved modern provider interfaces where appropriate;
- Yahoo Mail through approved provider interfaces or standards where supported;
- standards-based IMAP and SMTP for compatible providers;
- future adapters without redesigning the application core.

Unsupported provider operations must fail clearly and safely. GoreeCloud Mail must not simulate successful provider actions or claim authority it does not possess.

## Security and privacy invariants

- Email, HTML, links, attachments, protocol input, provider input, remote resources, and sender-controlled metadata are untrusted.
- Reusable credentials, encryption keys, signing material, provider tokens, mailbox passwords, and equivalent secrets must not be committed to source or ordinary project documentation.
- Authorization must be enforced at trusted service boundaries, not only in UI filtering.
- Cross-user and cross-account data leakage must fail closed.
- Protection claims must reflect authoritative Wardveil evidence and must not use absolute language unsupported by evidence.
- Privacy Shield minimization and user-control requirements apply to content, metadata, indexing, telemetry, logs, remote resources, and intelligent-assistance context.
- End-to-end or zero-access claims require an architecture in which the stated infrastructure cannot access the protected content; labels alone are insufficient.
- Provider-owned authentication, delivery, mailbox, domain, retention, or administration states must not be represented as GoreeCloud-owned when they are not.

## Secure-mail architecture requirements

OpenPGP/PGP-MIME, S/MIME, protected external messages, client-side encryption, eligible end-to-end encrypted Mail modes, digital signatures, key/certificate discovery, verification, revocation, recovery, and encrypted drafts/attachments must use explicit cryptographic boundaries and documented key lifecycle.

Secure-mail modes must define what metadata remains observable, including addressing, routing, timing, message size, and any subject/header information that the selected standard cannot conceal.

## Client and trusted-backend boundary

GoreeCloud Mail may run a trusted GoreeCloud backend for OAuth exchanges, provider credential custody, provider API mediation, synchronization support, security enforcement, attachment handling, notification coordination, search/index support, and cross-application workflows.

That trusted backend is an **application backend**, not an Internet email server. It does not create a separate authoritative mailbox, receive Internet email via GoreeCloud MX records, or deliver Internet email as a GoreeCloud mail transport service under the current architecture.

## Client targets

- Web
- Linux desktop
- Android
- iOS

Client capabilities may advance at different rates, but shared security, privacy, identity, data, and provider contracts must remain compatible.

## Acceptance model

A feature is considered implemented only when repository evidence exists. A feature is considered source-validated only when its exact revision passes the applicable automated or review gates. A feature is production-accepted only when the deployed runtime and required operational/security/privacy/continuity acceptance evidence are complete.

Documentation must distinguish these states. Planned capability lists are requirements, not implementation claims.

## Mail-server boundary

There are no current plans to build or operate a GoreeCloud Mail server, hosted mailbox provider, MX service, inbound SMTP infrastructure, outbound Internet delivery service, sender-reputation operation, or provider-scale abuse/support operation.

This is an intentional scope decision intended to avoid the maintenance, deliverability, reputation, abuse handling, support, compliance, and operational burden of running an email provider while GoreeCloud Mail focuses on delivering a strong client experience and GoreeCloud-native capabilities across existing providers.

If this changes in the future, it requires a new explicit architecture decision and documentation update. No dormant hosted-mail implementation should be treated as part of the current roadmap.

## Documentation set

- [README.md](README.md) — project overview and current status.
- [SPECIFICATIONS.md](SPECIFICATIONS.md) — architecture and product requirements.
- [FEATURES.md](FEATURES.md) — capability inventory and implementation status.
- [BENEFITS.md](BENEFITS.md) — intended user and platform benefits.
- [COMPETITIVE-OBJECTIVES.md](COMPETITIVE-OBJECTIVES.md) — product objectives and differentiation targets without unverified superiority claims.
- [docs/courier.md](docs/courier.md) — Courier identity source-control mirror.
