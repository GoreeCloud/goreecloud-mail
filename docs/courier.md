# Courier

## Identity

**Official name:** GoreeCloud Courier  
**Short name:** Courier  
**Related application:** GoreeCloud Mail  
**Role:** Unified first-party mail technology and feature framework  
**Status:** Approved for GoreeCloud Mail active development

## Purpose

Courier is the unified first-party mail technology and feature framework powering GoreeCloud Mail.

Courier gives the Mail project one coherent capability identity for the systems that retrieve, organize, compose, synchronize, search, secure, protect, and deliver the GoreeCloud email client experience. It is an internal product-capability identity rather than a separate standalone application.

GoreeCloud Mail remains the application name presented to users. Courier describes the first-party mail capabilities inside that application.

## Product boundary

Courier does **not** operate mailbox hosting, MX infrastructure, inbound SMTP service, outbound Internet mail-delivery infrastructure, sender-reputation infrastructure, or an independent GoreeCloud email provider.

External email providers remain authoritative for mailbox hosting and Internet mail transport. Courier owns the GoreeCloud-controlled client and trusted-backend experience.

Self-hosting Courier/GoreeCloud Mail means self-hosting the application and trusted backend, not self-hosting the user's Internet mailbox.

There are no current plans for a GoreeCloud-operated mail server. This boundary may change only through a future explicit GoreeCloud Mail architecture decision.

## Relationship to other GoreeCloud identities

Courier is complementary to the established platform systems rather than a replacement for them:

- **Glaze UI / Design Center** governs visual design, interaction, accessibility, responsiveness, and design-system governance.
- **Wardveil Security / Security Center** governs protection, detection, trust, verification, response, and security-sensitive Mail states.
- **Privacy Shield / Privacy Center** governs privacy, consent, data minimization, data governance, user control, tracking protection, and privacy-preserving defaults.
- **Everkeep / Continuity Center** governs resilience, backup, recovery, preservation, portability, succession, and continuity for eligible GoreeCloud-owned application state.
- **GoreeCloud Identity / Identity Center** governs GoreeCloud identity, authentication, authorization, accounts, credentials, devices, sessions, and delegated authority.
- **GoreeCloud Mesh / Mesh Center** governs authenticated platform coordination, integration, governance, capabilities, and events.
- **Courier** governs the unified first-party mail capability framework itself.

## Capability families

Courier capabilities may use descriptive names under the single umbrella when this improves product clarity. Approved capability direction includes:

- **Courier Inbox** — mailbox navigation, inbox organization, message lists, categories, priority, follow-up, and message-state experiences.
- **Courier Compose** — composition, drafts, replies, forwarding, identities, signatures, templates, scheduling, receipts, and send workflows.
- **Courier Sync** — provider synchronization, offline replay, cursors, idempotency, reconciliation, cross-device state, and continuity.
- **Courier Search** — local, provider-assisted, advanced, saved, smart-folder, and natural-language mail discovery.
- **Courier Rules** — filtering, classification, organization, automation, unsubscribe, cleanup, triage, and other configurable message handling.
- **Courier Attachments** — provider attachment retrieval, inspection, Wardveil Scan enforcement, storage, preview, filing, download, retention, and cleanup.
- **Courier Accounts** — external-provider account enrollment, OAuth authorization, credentials, provider capabilities, account isolation, revocation, and lifecycle.

These names are capability groups, not separate applications or repositories unless a future architecture explicitly approves otherwise.

## Provider independence

Courier must remain provider-independent. Gmail-specific, Microsoft-specific, Yahoo-specific, IMAP-specific, SMTP-specific, and other provider-specific implementation details must live behind documented normalized contracts wherever practical rather than becoming the product identity.

Provider adapters must expose only capabilities the configured provider actually supports. Courier must not invent mailbox, delivery, domain, alias, retention, or administration authority that belongs to the provider.

## Architecture principles

Courier must preserve strict user/account isolation, keep reusable provider credentials behind trusted backend and secret-storage boundaries, treat email/protocol content and attachments as untrusted input, preserve Privacy Shield controls, and use Wardveil Security for applicable protection decisions.

The trusted backend may mediate provider access, synchronization support, security enforcement, attachment handling, search/indexing, notifications, and GoreeCloud integration. It remains an application backend, not an Internet email server.

## Interface principles

Courier surfaces must use Glaze UI consistently and must not introduce a competing design language. Security-sensitive Courier states use Wardveil Security presentation and authority where applicable. Privacy controls use Privacy Shield presentation and policy. Identity-sensitive operations use GoreeCloud Identity authority. Cross-service actions use GoreeCloud Mesh contracts rather than direct undocumented database coupling.

## Naming rules

Use **GoreeCloud Courier** when formally identifying the capability framework in documentation, architecture records, release notes, and public explanations where the GoreeCloud relationship needs to be explicit.

Use **Courier** in ordinary GoreeCloud Mail interface text, developer documentation, component names, and internal capability references when the application context is already clear.

Do not rename GoreeCloud Mail to Courier. Do not present Courier as an email provider or server. Do not create a separate Courier repository merely because Courier is a named capability identity. Do not create unrelated sub-brands for ordinary Mail features when a clear descriptive Courier capability name is sufficient.

## Source-of-truth relationship

The authoritative product definition remains the GoreeCloud Mail project specification and the Courier Identity Standard in Google Drive. This repository document is the source-control mirror for Courier capability identity and implementation guidance.
