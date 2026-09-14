# GoreeCloud Mail — Feature Roadmap

**Status:** Active roadmap control  
**As of:** 2026-09-14  
**Authoritative project record:** Project Specification — Mail  
**Canonical repository:** GoreeCloud/goreecloud-mail  
**Drive control:** `GoreeCloud/Feature Roadmap/GoreeCloud Mail/FEATURE-ROADMAP.docx`

## Purpose

This file is the repository-side feature roadmap control for GoreeCloud Mail. It records current planned and recommended feature work without replacing the authoritative project record, implementation evidence, release gates, or GoreeCloud Tasks Management.

## Current Android authority boundary

The current Android Development stack through Draft PR #59 establishes provider-independent account-response decoding and a fail-closed GoreeCloud Identity native-registration readiness contract. It does not create a production Identity registration, native credential/session exchange, provider network transport, local authoritative mailbox, offline synchronization authority, or production-capable Android client.

Provider mailbox hosting and Internet mail transport remain authoritative to the configured external provider. GoreeCloud Identity application authentication and external-provider authorization are separate boundaries. Browser cookies, embedded reusable credentials, and consumer-selected Identity registration values must not be used to bypass those authorities.

## Roadmap

| ID | Feature / obligation | Priority | Current state |
| --- | --- | --- | --- |
| FR-001 | Reconcile and maintain every current planned or recommended GoreeCloud Mail feature from the authoritative project record and verified repository evidence in this roadmap. | High | Ongoing control |
| FR-002 | Move actionable feature obligations into GoreeCloud Tasks Management when required, preserving priority, dependency, and lifecycle disposition. | High | Ongoing control |
| FR-003 | Do not mark features implemented, complete, cancelled, or superseded without authoritative evidence and synchronized repository/Drive roadmap updates. | High | Ongoing control |
| FR-010 | Preserve GoreeCloud Mail as a provider-independent first-party email client; external providers remain authoritative for mailbox hosting and Internet mail transport unless a future explicit architecture decision changes that boundary. | High | Ongoing product boundary |
| FR-011 | Maintain a shared provider capability contract for mailbox discovery, message retrieval, search, send, drafts, move/archive/delete/flag, synchronization, and provider capability reporting without embedding one provider’s semantics into the product core. | High | Development foundation present; provider execution acceptance remains open |
| FR-012 | Implement and validate supported provider adapters, initially Gmail through approved modern authorization/provider APIs and standards-based IMAP/SMTP where applicable. | High | Provider-specific production execution pending |
| FR-013 | Keep GoreeCloud Identity application authentication separate from external-provider authorization; define governed native application registration before native credential/session exchange. | High | Source readiness active through PR #59; runtime registration acceptance false |
| FR-014 | Establish authenticated Android provider transport only after Identity-owned registration, native session/credential exchange, provider authorization, protected credential storage, and transport policy are independently accepted. | High | Blocked prerequisite; no Android network transport authorized |
| FR-015 | Complete mailbox, message/conversation, compose/send, draft, archive/move/delete/spam/flag, search, attachment, multi-select, sender-identity, and notification workflows across supported client surfaces. | High | Development scope; full provider-backed acceptance pending |
| FR-016 | Apply Wardveil Security to untrusted email HTML, links, attachments, authentication/security states, redirects, and other hostile-content boundaries without overstating protection. | High | Development evidence exists; complete production acceptance pending |
| FR-017 | Apply Privacy Shield and privacy-by-default controls to remote content, tracking pixels, third-party resource loading, telemetry/logging, local retention, synchronized mail, attachments, and provider credentials. | High | Required; runtime/product acceptance incomplete |
| FR-018 | Define controlled offline synchronization: bounded cache windows, drafts/actions queues, incremental sync, retries/idempotency, conflict reconciliation, attachment caching, and explicit queued-vs-provider-accepted states. | High | Planned / prerequisite for full native offline operation |
| FR-019 | Preserve strict account/user isolation across messages, caches, search/index state, attachments, credentials, notifications, and synchronization; server-side authorization remains required where server components participate. | High | Required invariant; complete production evidence pending |
| FR-020 | Integrate Contacts, Calendar, Tasks, Notes/Memos, Notify, and other approved GoreeCloud services through documented interfaces without tightly coupling internal databases or transferring authority. | Medium | Planned / incremental integration |
| FR-021 | Maintain secure attachment handling for filenames, MIME/type presentation, paths, sizes, previews, downloads/uploads, cross-account access, and Wardveil verification/release boundaries. | High | Development hardening active; full provider/device acceptance pending |
| FR-022 | Deliver a first-party Linux desktop client with desktop notifications, mailto handling, attachment workflows, keyboard efficiency, offline synchronization, packaging, accessibility, and operating-system integration. | Medium | Planned / production desktop acceptance pending |
| FR-023 | Maintain the first-party Android/Kotlin client as a Development surface with provider/account contracts, source-only Identity readiness, least-privilege permissions, and no fabricated runtime authority. | High | Active Development through Draft PR #59 |
| FR-024 | Advance Android account/provider discovery and response handling only through bounded, typed, fail-closed contracts; do not treat decoded provider/account metadata as authentication or mailbox authority. | High | Source-ready Development foundation in current stack |
| FR-025 | Add Android provider-backed mailbox reads, compose/send, attachments, notifications, share intents, offline access, and background synchronization only after FR-013/FR-014/FR-018 authority and lifecycle prerequisites are accepted. | High | Blocked on authentication/transport/synchronization prerequisites |
| FR-026 | Migrate every supported Mail surface to the current Stable GLAZE UI version and obtain independent rendered, accessibility, RTL/localization, large-text, reduced-effects, form-factor, representative-device/desktop, performance, rollback, and applicable human-visual acceptance. | High | Required migration/acceptance; current Stable is V1.4 / 1.4.0 |
| FR-027 | Complete production monitoring, privacy/security evidence, backup/recovery for GoreeCloud-owned state, dependency/vulnerability management, controlled signing/provenance, upgrade/rollback, release approval, and Stable qualification. | High | Blocked on production acceptance gates |
| FR-028 | Evaluate and implement iOS only after shared provider, authentication, synchronization, security/privacy, and primary client architecture are sufficiently stable and accepted. | Low | Long-term target |

## Maintenance and synchronization

This roadmap and the corresponding Drive `FEATURE-ROADMAP.docx` must remain materially synchronized with one another and with the authoritative project or service record. Update both copies whenever feature scope, priority, dependency, implementation status, cancellation, supersession, recommendation, or verification state materially changes.

No feature may be represented as complete or Stable solely because it appears in this roadmap. Completion and lifecycle claims require the applicable authoritative implementation, validation, review, release, and production evidence.

## Reconciliation rule

At each material feature change, reconcile this roadmap against the current authoritative project record, repository implementation state, applicable platform-system requirements, and GoreeCloud Tasks Management. Missing obligations, stale status, duplicated work, roadmap drift, or undocumented disposition changes are defects to correct.
