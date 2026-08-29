# Courier

## Identity

**Official name:** GoreeCloud Courier  
**Short name:** Courier  
**Related application:** GoreeCloud Mail  
**Role:** Unified first-party mail technology and feature framework  
**Status:** Approved for GoreeCloud Mail active development

## Purpose

Courier is the unified first-party mail technology and feature framework powering GoreeCloud Mail.

Courier gives the Mail project one coherent capability identity for the systems that receive, retrieve, host, organize, compose, synchronize, search, secure, protect, and deliver the GoreeCloud email experience. It is an internal product-capability identity rather than a separate standalone application.

GoreeCloud Mail remains the application and service name presented to users. Courier describes the first-party mail capabilities inside that platform.

## Product boundary

Courier now supports two explicit GoreeCloud Mail operating modes:

- **GoreeCloud-hosted service mode** — first-party mailbox, domain, alias, policy, inbound-mail, outbound-mail, storage, administration, and related service capabilities as they are independently implemented and accepted.
- **External-provider interoperability mode** — provider-independent access to compatible external email providers through documented adapters and normalized contracts.

The hosted-service scope is an approved product target, not a claim that production mailbox hosting, MX service, SMTP delivery, reputation infrastructure, or hosted-domain operation is already deployed. Current production acceptance remains separate and must be evidence-backed.

External-provider interoperability remains a permanent supported capability rather than a transitional implementation that must be discarded when hosted services arrive.

## Relationship to other GoreeCloud identities

Courier is complementary to the established platform systems rather than a replacement for them:

- **Glaze UI / Design Center** governs visual design, interaction, accessibility, responsiveness, and design-system governance.
- **Wardveil Security / Security Center** governs protection, detection, trust, verification, response, and security-sensitive Mail states.
- **Privacy Shield / Privacy Center** governs privacy, consent, data minimization, data governance, user control, tracking protection, and privacy-preserving defaults.
- **Everkeep / Continuity Center** governs resilience, backup, recovery, preservation, portability, succession, and continuity where applicable.
- **GoreeCloud Identity / Identity Center** governs GoreeCloud identity, authentication, authorization, accounts, credentials, devices, sessions, and delegated authority.
- **GoreeCloud Mesh / Mesh Center** governs authenticated platform coordination, integration, governance, capabilities, and events.
- **Courier** governs the unified first-party mail capability framework itself.

## Capability families

Courier capabilities may use descriptive names under the single umbrella when this improves product clarity. Approved capability direction includes:

- **Courier Inbox** — mailbox navigation, inbox organization, message lists, categories, priority, follow-up, and message-state experiences.
- **Courier Compose** — composition, drafts, replies, forwarding, identities, signatures, templates, scheduling, receipts, and send workflows.
- **Courier Sync** — synchronization, offline replay, cursors, idempotency, reconciliation, cross-device state, and continuity.
- **Courier Search** — local, server-side, provider-assisted, advanced, saved, smart-folder, and natural-language mail discovery.
- **Courier Rules** — filtering, classification, organization, automation, unsubscribe, cleanup, triage, and other configurable message handling.
- **Courier Attachments** — attachment retrieval, inspection, Wardveil Scan enforcement, storage, preview, filing, download, retention, and cleanup.
- **Courier Accounts** — GoreeCloud-hosted and external-provider account enrollment, aliases, domains, authorization, credentials, capabilities, and account isolation.
- **Courier Secure Mail** — encrypted-mail, cryptographic signature, protected-message, client-side-encryption, OpenPGP/PGP-MIME, S/MIME, and related secure-email capabilities as implemented.
- **Courier Service** — hosted mailbox, inbound transport, outbound transport, custom-domain, retention, administrative, and service-control capabilities as implemented.

These names are capability groups, not separate applications or repositories unless a future architecture explicitly approves otherwise.

## Architecture principles

Courier must remain provider-independent and mode-aware. Gmail-specific, IMAP/SMTP-specific, and GoreeCloud-hosted transport implementations must live behind documented contracts rather than becoming the product identity.

Courier must preserve strict user/account/organization isolation, keep reusable credentials behind trusted backend and secret-storage boundaries, treat email/protocol content and attachments as untrusted input, preserve Privacy Shield controls, and use Wardveil Security for applicable protection decisions.

Hosted and external-provider modes must not silently borrow authority from one another. A capability that requires GoreeCloud-hosted mailbox or transport authority must fail closed when the selected account is external-provider-backed unless the external provider explicitly exposes an equivalent normalized capability.

## Interface principles

Courier surfaces must use Glaze UI consistently and must not introduce a competing design language. Security-sensitive Courier states use Wardveil Security presentation and authority where applicable. Privacy controls use Privacy Shield presentation and policy. Identity-sensitive operations use GoreeCloud Identity authority. Cross-service actions use GoreeCloud Mesh contracts rather than direct undocumented database coupling.

## Naming rules

Use **GoreeCloud Courier** when formally identifying the capability framework in documentation, architecture records, release notes, and public explanations where the GoreeCloud relationship needs to be explicit.

Use **Courier** in ordinary GoreeCloud Mail interface text, developer documentation, component names, and internal capability references when the application context is already clear.

Do not rename GoreeCloud Mail to Courier. Do not present Courier as a separate independent company, application, or provider brand. Do not create unrelated sub-brands for ordinary Mail features when a clear descriptive Courier capability name is sufficient.

## Source-of-truth relationship

The authoritative product definition remains the GoreeCloud Mail project specification and the Courier Identity Standard in Google Drive. This repository document is the source-control mirror for Courier capability identity and implementation guidance.
