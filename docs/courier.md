# Courier

## Identity

**Official name:** GoreeCloud Courier  
**Short name:** Courier  
**Related application:** GoreeCloud Mail  
**Role:** Unified first-party mail technology and feature framework  
**Status:** Approved for GoreeCloud Mail active development

## Purpose

Courier is the unified first-party mail technology and feature framework powering GoreeCloud Mail.

Courier gives the Mail project one coherent capability identity for the systems that retrieve, organize, compose, synchronize, search, secure, protect, and deliver the GoreeCloud email experience. It is an internal product-capability identity rather than a separate standalone application.

GoreeCloud Mail remains the application name presented to users. Courier describes the first-party mail capabilities inside that application.

## Product boundary

Courier does not operate mailbox hosting, SMTP delivery infrastructure, MX service, sender-reputation infrastructure, or an independent GoreeCloud email server.

External email providers remain authoritative for mailbox hosting and mail transport. Courier owns the client-side and trusted-backend experience that GoreeCloud controls.

## Relationship to other GoreeCloud identities

Courier is complementary to the established platform identities rather than a replacement for them:

- **Glaze UI** governs visual and interaction design.
- **Wardveil Security** governs security-sensitive experiences and protection states.
- **GoreeCloud Privacy Shield** governs privacy protections and privacy-preserving defaults.
- **Everkeep** governs resilience, preservation, backup, and recovery where applicable.
- **Courier** governs the unified first-party mail capability framework.

## Capability families

Courier capabilities may use descriptive names under the single umbrella when this improves product clarity. Initial approved naming direction includes:

- **Courier Inbox** — mailbox and message-list experiences.
- **Courier Compose** — message composition, drafts, replies, forwarding, identities, and send workflows.
- **Courier Sync** — provider synchronization, offline replay, cursors, idempotency, and reconciliation.
- **Courier Search** — local and provider-assisted mail search and indexing.
- **Courier Rules** — future filtering, organization, automation, and message-handling rules.
- **Courier Attachments** — attachment retrieval, inspection, storage, preview, and delivery boundaries.
- **Courier Accounts** — provider-account enrollment, OAuth authorization, credentials, capabilities, and account isolation.

These names are capability groups, not separate applications or repositories unless a future architecture explicitly approves otherwise.

## Architecture principles

Courier must remain provider-independent. Gmail-specific and standards-based IMAP/SMTP implementations must live behind normalized provider contracts rather than becoming the product identity.

Courier must preserve strict user/account isolation, keep reusable provider credentials behind trusted backend and secret-storage boundaries, treat all email content and attachments as untrusted input, and maintain Privacy Shield remote-content defaults.

## Interface principles

Courier surfaces must use Glaze UI consistently and must not introduce a competing design language. Security-sensitive Courier states should use Wardveil Security presentation where appropriate. Privacy controls should use Privacy Shield presentation where appropriate.

## Naming rules

Use **GoreeCloud Courier** when formally identifying the capability framework in documentation, architecture records, release notes, and public explanations where the GoreeCloud relationship needs to be explicit.

Use **Courier** in ordinary GoreeCloud Mail interface text, developer documentation, component names, and internal capability references when the application context is already clear.

Do not rename GoreeCloud Mail to Courier. Do not present Courier as an email provider or server. Do not create unrelated sub-brands for ordinary Mail features when a clear descriptive Courier capability name is sufficient.

## Source-of-truth relationship

The authoritative product definition remains the GoreeCloud Mail project specification in Google Drive. This repository document is the source-control mirror for the Courier capability identity and implementation guidance.
