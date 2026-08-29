# GoreeCloud Mail

Privacy-first, secure first-party GoreeCloud email and communication platform for web, Linux, Android, and iOS, with native GoreeCloud-hosted service direction, external-provider interoperability, Glaze UI, Wardveil Security, Privacy Shield, Everkeep, GoreeCloud Identity, and GoreeCloud Mesh integration.

## Status

**Active development. Production deployment is not approved.**

The approved product scope now extends beyond the original client-only boundary. GoreeCloud Mail is intended to operate in two explicit modes:

- **GoreeCloud-hosted service mode** for first-party mailbox hosting, inbound/outbound mail transport, custom domains, aliases, retention, organization controls, protected storage, and related service capabilities as they are implemented and accepted.
- **External-provider interoperability mode** for compatible providers through provider-independent contracts, including the existing Gmail API and standards-based IMAP/SMTP foundations.

The scope expansion is a product and architecture decision, not a claim that hosted mail transport is already running. Current `main` before this development branch remains the source-validated provider/client and Wardveil attachment-security foundation. Hosted mailbox service, MX operation, production SMTP delivery, custom-domain hosting, real-provider production connectivity, and the complete feature target remain separately pending implementation and acceptance.

## Current implementation foundation

The repository currently includes:

- Glaze UI responsive web shell and Mail reader foundation;
- provider-independent `MailProvider` contract and same-origin provider gateway;
- Gmail and IMAP/SMTP external-provider adapter foundations;
- trusted session-derived GoreeCloud user identity and user-scoped provider-account handling;
- OAuth state lifecycle, Gmail PKCE/OAuth construction, token refresh/revocation, and normalized provider errors;
- bounded provider timeout, retry, backoff, and rate-limit handling;
- durable SQLite application state for provider accounts, credential references, OAuth state, synchronization state, operation idempotency, and attachment metadata;
- encrypted provider credential-vault foundation with AES-256-GCM and key rotation support;
- schema migrations plus SQLite backup/integrity verification tooling;
- fail-closed HTML message policy pending a maintained production sanitizer;
- Privacy Shield remote-content defaults;
- attachment byte inspection, private object storage, ownership-bound delivery, expiry, and cleanup;
- Wardveil Scan signed transport, exact content binding, fail-closed attachment-delivery enforcement, and minimized durable clean-scan provenance;
- a platform-mode capability contract on the scope-expansion branch that explicitly separates `goreecloud-hosted` authority from `external-provider` authority.

Synthetic provider tests continue to prove important isolation, lifecycle, retry, synchronization, idempotency, content-boundary, encryption, persistence, migration, backup, recovery, and attachment semantics without representing a real mailbox as production-connected.

## Product role

GoreeCloud Mail is GoreeCloud's first-party email and communication platform. It combines mailbox and conversation experiences, composition, search, automation, intelligent assistance, privacy, security, identity, synchronization, continuity, interoperability, and approved first-party mail-service capabilities.

**GoreeCloud Courier** is the unified first-party mail technology and feature framework powering GoreeCloud Mail. Courier is not a separate application or repository.

## Capability target

The approved native built-in target includes:

- complete inbox and multi-account management;
- labels, categories, priority/focused/split inboxes, VIPs, and custom views;
- advanced, saved, smart-folder, server-side, and natural-language search;
- rules, unsubscribe, automated cleanup, triage, and plain-language automation;
- snooze, reminders, follow-up, awaiting-reply, reply queues, and inbox-zero workflows;
- rich/plain composition, attachments, aliases, identities, signatures, templates, groups, and snippets;
- scheduled send, Undo Send, delivery timing, and supported receipt/read-state capabilities;
- native spelling, grammar, predictive writing, drafting, rewriting, summarization, and context-aware assistance;
- intelligent digests, sender classification, meeting/calendar context, attachment filing, newsletter management, and mailbox insights;
- secure-mail targets including OpenPGP, PGP/MIME, S/MIME, digital signatures, client-side encryption, eligible end-to-end protected workflows, and zero-access storage modes only where the implemented architecture actually supports that claim;
- Wardveil-backed phishing, suspicious-link, malicious-attachment, sender/authentication, spam, and account protection;
- Privacy Shield tracking/IP/remote-content protections, protected-message controls, aliases, and custom domains;
- organization administration, retention, policy, security-event history, interoperability, and private/self-hosted deployment capability;
- deep first-party integration with GoreeCloud Sync, Drive, Location, Backups, Identity, Wardveil Security, Privacy Shield, Everkeep, Mesh, Contacts, Calendar, Tasks, Notes/Memos, Notify, Search, and future approved GoreeCloud services.

See [FEATURES.md](FEATURES.md) for the capability inventory and state rules.

## Architecture modes

### GoreeCloud-hosted service

Hosted mode is the approved direction for first-party mailbox and mail-transport authority. Production acceptance will require explicit architecture and evidence for mailbox lifecycle, storage, indexing, inbound SMTP, outbound delivery, queues/retries/bounces, DKIM/SPF/DMARC alignment, DNS/domain enrollment, spam/abuse controls, reputation/deliverability, retention, administration, observability, disaster recovery, and continuity.

### External providers

The existing provider architecture remains supported. Browser clients communicate through trusted GoreeCloud service boundaries rather than receiving reusable provider credentials. Provider adapters normalize supported operations and capabilities while preserving provider-owned authority.

Hosted-only actions must not silently run against external-provider accounts. External-provider behavior must not be mistaken for GoreeCloud-hosted service authority.

## Security and privacy boundaries

Email content, HTML, links, attachments, provider responses, protocol data, sender metadata, and remote resources are untrusted input.

Credentials, OAuth codes, refresh tokens, app passwords, cryptographic keys, session material, and other reusable secrets must never be committed to this repository or exposed in browser-visible responses. Cross-user, cross-account, cross-organization, and cross-mode references must fail closed.

Wardveil Security is the security authority for applicable Mail protection decisions. Privacy Shield governs privacy, consent, data minimization, user control, remote resources, tracking protection, intelligent-assistance context, and privacy-sensitive data flows. Everkeep governs continuity and preservation treatment. GoreeCloud Identity governs GoreeCloud identity/authentication/authorization boundaries. GoreeCloud Mesh governs authenticated policy-controlled cross-service coordination.

## Wardveil attachment scanning

GoreeCloud Mail's trusted attachment-delivery service now requires Wardveil Scan before provider attachment bytes can become a downloadable cached object. Mail does not connect directly to ClamAV and does not reinterpret raw scanner output as an authoritative security verdict.

Only a current authoritative clean result with exact resource, scope, correlation, evidence, validity, and SHA-256 content binding may proceed. Malicious, suspicious, unknown, unsupported, invalid, expired, or scanner-unavailable outcomes fail closed before downloadable storage. A malicious result may expose a bounded non-destructive quarantine-required state; Mail does not become the Wardveil Quarantine executor.

Current clean scan provenance may survive Mail service restart through a private minimized sidecar bound to the attachment object and digest. Missing, corrupt, tampered, expired, or mismatched provenance fails closed. This source-validated application state is not Wardveil Audit and is not production runtime acceptance.

## Planned clients

- Web
- Linux desktop
- Android
- iOS

## Required platform systems

Stable qualification requires current approved integration with:

- Glaze UI / Design Center
- Wardveil Security / Security Center
- Privacy Shield / Privacy Center
- Everkeep / Continuity Center
- GoreeCloud Identity / Identity Center
- GoreeCloud Mesh / Mesh Center

Applicable Mail workflows also integrate with GoreeCloud Sync, Drive, Location, Backups, Contacts, Calendar, Tasks, Notes/Memos, Notify, Search, and other approved first-party services.

## Documentation

- [SPECIFICATIONS.md](SPECIFICATIONS.md)
- [FEATURES.md](FEATURES.md)
- [BENEFITS.md](BENEFITS.md)
- [COMPETITIVE-OBJECTIVES.md](COMPETITIVE-OBJECTIVES.md)
- [docs/courier.md](docs/courier.md)
- [docs/provider-backend-contract.md](docs/provider-backend-contract.md)
- [docs/database-maintenance.md](docs/database-maintenance.md)
- [docs/credential-vault.md](docs/credential-vault.md)

## Validation

Run the source test suite with:

```bash
npm test
```

Run trusted backend tests with:

```bash
npm run test:backend
```

GitHub Actions runs repository tests and static secret-safety checks. Exact-head source validation is required after material security/backend milestones.

Passing source tests do not constitute production acceptance. Real provider connectivity, hosted-mail transport, target-host credential/key custody, production HTML sanitization, durable recovery, runtime hardening, deliverability operations, native packaging, platform-system acceptance, and production-readiness validation remain separate requirements.

## License

License selection is pending final project approval.
