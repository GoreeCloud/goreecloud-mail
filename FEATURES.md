# GoreeCloud Mail — Features

## Status key

- **Source-validated** — implementation exists in source and has passed recorded source validation for its exact milestone.
- **Implemented, acceptance pending** — implementation exists but the required current validation or production acceptance is incomplete.
- **Target** — approved native built-in capability; implementation and production acceptance are not implied.
- **Provider/standard dependent** — capability is exposed only when the selected provider, protocol, cryptographic standard, recipient, or deployment mode can support it accurately.

The target inventory below defines GoreeCloud Mail product scope. It must not be read as a claim that every listed feature is already deployed.

## Current source-validated foundations

| Capability | State |
| --- | --- |
| Glaze UI responsive web shell, mailbox/message reader foundation | Source-validated development foundation |
| Provider-independent MailProvider and same-origin provider gateway | Source-validated development foundation |
| Gmail API and IMAP/SMTP external-provider adapter foundations | Source-validated with synthetic provider data; real-provider production acceptance pending |
| Trusted session identity and user-scoped provider accounts | Source-validated |
| OAuth state/PKCE/token lifecycle and separate credential-vault boundaries | Source-validated; production key custody/runtime acceptance pending |
| Encrypted file credential vault with rotation foundation | Source-validated; production secret-store acceptance pending |
| SQLite durable state, migrations, backup/integrity verification, sync cursors, idempotency | Source-validated; target-host recovery acceptance pending |
| Privacy Shield remote-content blocking defaults | Source-validated policy foundation |
| Fail-closed HTML rendering boundary | Source-validated policy; maintained production sanitizer pending |
| Attachment byte inspection, private object storage, owner-bound delivery, durable metadata and cleanup | Source-validated development foundation |
| Wardveil Scan signed transport, exact-byte binding, delivery enforcement, and durable clean-scan provenance | Source-validated; production Wardveil runtime acceptance pending |
| Explicit `goreecloud-hosted` vs `external-provider` platform capability contract | Implemented on the scope-expansion development branch; PR/CI acceptance pending |

## Core email and inbox — Target

Unified inbox; multiple accounts; conversation/thread view; Inbox, Sent, Drafts, Archive, Spam, Trash and other essential mailbox views; custom folders; archive; delete; Trash recovery; read/unread state; stars/flags; pinned messages; muted conversations; moving; bulk selection; bulk archive/delete/read-state/move; sender grouping; and a message preview pane.

## Organization and categorization — Target

Labels/tags; multiple labels per message; color-coded tags; automatic categorization; priority inbox; focused inbox; split inboxes; VIP senders; important-message detection; newsletter, promotion, notification, and calendar-mail categories; custom inbox categories; and custom inbox sections.

## Search and discovery — Target

Advanced search; sender/recipient/subject/date/attachment/mailbox/file-type criteria; server-side search; quick filters; saved searches; smart search folders; unread-only, favorite-folder, recently-used-folder, and tag views; natural-language search; and natural-language questions over mailbox content subject to authorization and privacy controls.

## Rules and automated inbox management — Target

Automatic sorting; sender and multi-condition rules; forwarding; archive/delete actions; recurring-sender cleanup; one-click and bulk unsubscribe; unsubscribe-and-archive; automatic labels; plain-language rules; automated triage; automatic sender categorization; custom automation instructions; and combined archive-and-label workflows.

## Productivity and inbox workflows — Target

Snooze and exact snooze times; remind-me-later; automatic/manual follow-up reminders; follow-up suggestions; awaiting-reply tracking; needs-reply view; inbox-zero workflow; mark-as-done; set-aside; reminder inbox; automatic resurfacing; priority highlighting; unknown-sender gatekeeping; cold-email detection/labeling/archiving; custom unwanted-mail definitions; attachment reminders; reply queues; and inbox cleanup recommendations.

## Composing and sending — Target

Rich-text and plain-text composition; headings/emphasis/lists/indentation/links/alignment; inline images; file attachments; attachment preview/save; drag-and-drop attachments; single and multiple signatures; multiple sender identities; approved aliases; reply/reply-all/forward/resend; BCC and BCC-to-self; contact groups; distribution lists; reusable and shared templates; text snippets; and dynamic placeholders.

## Sending controls — Target

Scheduled send; exact scheduled times; cancel/edit scheduled mail; configurable Undo Send grace period; configurable send delay; intelligent delivery timing; supported read receipts; delivery receipts; supported read-status tracking; recent-open information; and recipient-open indicators. Receipt/open features are **provider/standard dependent** and must not be represented as guaranteed tracking.

## Writing assistance — Target

Spell checking; grammar checking; autocorrect; predictive writing; smart replies; sentence completion; complete draft generation; writing-style-aware drafting; follow-up drafts; rewriting; tone adjustment; shortening; expansion; thread-context-aware replies; and relevant correspondence-history-aware drafting, all within Privacy Shield and authorization boundaries.

## Intelligent mail assistance — Target

Conversation and message summaries; intelligent priority detection; sender classification; automated digests; unanswered-message reminders; meeting-context and calendar-aware drafting; pre-meeting email briefings; contact-context summaries; automated attachment filing/organization; newsletter management; unwanted-outreach filtering; communication/mailbox activity insights; high-volume sender identification; category statistics; and largest-message/storage identification.

## Privacy and secure email — Target

End-to-end encrypted eligible mail; zero-access protected mailbox storage modes where the approved architecture actually prevents infrastructure access; OpenPGP; PGP/MIME; digital signatures and verification; password/passcode-protected external messages; encryption-status indicators; encrypted attachments; encrypted drafts; protected subjects where supported; Autocrypt; S/MIME; client-side encryption; and TLS-secured transport.

Cryptographic features must use mature reviewed primitives and explicit key/certificate lifecycle. Metadata limitations must be documented rather than hidden behind an encryption label.

## Threat protection — Target

Wardveil-backed phishing detection; suspicious-link warnings; spam filtering; sender verification signals; remote-content blocking; malicious-attachment detection; suspicious-sender/impersonation warnings; authentication warnings; and Mail account-security alerts.

Protection states must remain evidence-backed. Wardveil is the security authority; Mail must not fabricate scanner or threat certainty.

## Privacy controls — Target

IP-address protection; tracking protection; private remote-content loading; tracking-pixel blocking; eligible protected-message expiration and access revocation; forwarding/copy/printing/download restrictions where enforceable; additional verification for protected external mail; disposable aliases; private aliases; multiple aliases; and custom-domain addresses.

Restrictions must be described according to their actual enforcement boundary; standard interoperable email cannot guarantee remote-recipient behavior after plaintext has legitimately reached an uncontrolled endpoint.

## Account protection and administration — Target

Security-event history; account-specific notifications; authentication-error alerts; open standards interoperability; approved private/self-hosted deployments; organization policy; configurable retention/preservation; and authorized organizational Mail administration.

## Deep GoreeCloud integration — Target

- **GoreeCloud Sync:** messages, drafts, mailbox state, settings, rules, signatures, preferences, metadata, and cross-device continuity where authorized.
- **GoreeCloud Drive:** attach, save, share, open, review, and collaborate on eligible files.
- **GoreeCloud Location:** explicitly authorized regional, travel, and context-aware workflows only.
- **GoreeCloud Backups:** eligible Mail state/configuration/data protection according to backup policy.
- **Wardveil Security / Security Center:** threat detection, link analysis, attachment scanning, security signals, account protection, verification, response, and evidence-backed states.
- **Privacy Shield / Privacy Center:** data minimization, consent, tracking protection, permissions, privacy contracts, and user controls.
- **Everkeep / Continuity Center:** resilience, preservation, recovery, portability, succession, legacy, and continuity.
- **GoreeCloud Identity / Identity Center:** GoreeCloud authentication, account identity, sender identities, aliases, organization identities, trusted relationships, recovery, authorization, credentials, sessions, and supported verification.
- **GoreeCloud Mesh / Mesh Center:** authenticated policy-controlled service-to-service coordination, capabilities, governance, and events.
- Cross-application file workflows and sharing.
- Shared authorized contact, identity, organization, and relationship context.
- Shared security intelligence and privacy controls within strict data boundaries.
- GoreeCloud-wide search interoperability when authorized.
- Application-to-Mail and Mail-to-application actions.
- Shared notification infrastructure.
- Platform automation actions/triggers with explicit authority.
- Unified account/policy management.
- Continuity/recovery coordination among Sync, Backups, Everkeep, Identity, and related systems.
- Extensible integration with future GoreeCloud applications, services, devices, and infrastructure.

## GoreeCloud Mail as a platform service — Target

GoreeCloud Mail is intended to operate as both a complete first-party email service and an interoperable mail application platform. A single workflow may combine Courier mail capabilities with Drive, Sync, Identity, Wardveil Security, Privacy Shield, Backups, Everkeep, Mesh, and other authorized GoreeCloud systems while preserving explicit permissions and authority boundaries.

## Hosted-service capability target

The product scope now includes first-party hosted mailboxes, custom domains, aliases, inbound transport, outbound transport, protected storage, indexing/search, retention, organization administration, policy, abuse controls, and operational mail-service infrastructure. These are **Target** capabilities until repository and deployed evidence establish their implementation and acceptance.

## Validation rule

No row or capability changes from Target to Implemented, Source-validated, or Production-accepted merely because it appears in this document. State changes require implementation evidence and the applicable validation/acceptance record.
