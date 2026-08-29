# GoreeCloud Mail

Privacy-first, secure first-party GoreeCloud email client and communication experience for web, Linux, Android, and iOS, with provider-independent access to compatible external mail services, Glaze UI, Wardveil Security, Privacy Shield, Everkeep, GoreeCloud Identity, and GoreeCloud Mesh integration.

## Status

**Active development. Production deployment is not approved.**

GoreeCloud Mail is a **client platform**, not a GoreeCloud-operated email provider. Mailbox hosting and Internet mail transport remain the responsibility of configured external providers such as Gmail, Microsoft Outlook/Exchange-compatible services, Yahoo Mail, and other compatible providers exposed through provider APIs or standards such as IMAP and SMTP.

There are **no current plans** for GoreeCloud Mail to operate mailbox hosting, MX infrastructure, inbound SMTP servers, outbound mail-delivery infrastructure, sender-reputation systems, or a GoreeCloud email-provider service. That boundary may be reconsidered only through a future explicit architecture decision.

Self-hosted GoreeCloud Mail deployment refers to hosting the GoreeCloud Mail application and trusted backend, not hosting users' Internet email service.

## Current implementation foundation

The repository currently includes:

- Glaze UI responsive web shell and Mail reader foundation;
- provider-independent `MailProvider` contract and same-origin provider gateway;
- Gmail and standards-based IMAP/SMTP external-provider adapter foundations;
- trusted session-derived GoreeCloud user identity and user-scoped provider-account handling;
- OAuth state lifecycle, Gmail PKCE/OAuth construction, token refresh/revocation, and normalized provider errors;
- bounded provider timeout, retry, backoff, and rate-limit handling;
- durable SQLite application state for provider accounts, credential references, OAuth state, synchronization state, operation idempotency, and attachment metadata;
- encrypted provider credential-vault foundation with AES-256-GCM and key rotation support;
- schema migrations plus SQLite backup/integrity verification tooling;
- fail-closed HTML message policy pending a maintained production sanitizer;
- Privacy Shield remote-content defaults;
- attachment byte inspection, private object storage, ownership-bound delivery, expiry, and cleanup;
- Wardveil Scan signed transport, exact content binding, fail-closed attachment-delivery enforcement, and minimized durable clean-scan provenance.

Synthetic provider tests prove important isolation, lifecycle, retry, synchronization, idempotency, content-boundary, encryption, persistence, migration, backup, recovery, and attachment semantics without representing a real mailbox as production-connected.

## Product role

GoreeCloud Mail is GoreeCloud's first-party email client and communication platform experience. It owns the GoreeCloud interface, workflows, local/trusted-backend logic, privacy controls, security integration, synchronization behavior, intelligent assistance, and wider GoreeCloud interoperability while external providers remain authoritative for mailbox hosting and external mail transport.

**GoreeCloud Courier** is the unified first-party mail technology and feature framework powering GoreeCloud Mail. Courier is not a separate application, provider, or repository.

## Capability target

The approved native built-in target includes:

- unified inbox, multiple accounts, conversation views, standard/custom mailboxes, bulk actions, pinning, muting, stars/flags, and preview-pane workflows;
- labels, categories, priority/focused/split inboxes, VIPs, sender grouping, custom sections, and intelligent categorization;
- advanced, saved, smart-folder, provider/server-assisted, and natural-language search;
- rules, unsubscribe, automated cleanup, triage, sender classification, and plain-language automation;
- snooze, reminders, follow-up, awaiting-reply, needs-reply, reply queues, inbox-zero, and unwanted-mail workflows;
- rich/plain composition, attachments, aliases and sender identities where supported, signatures, templates, groups, snippets, and dynamic placeholders;
- scheduled send, Undo Send, configurable send delay, delivery timing, and supported receipt/read-state capabilities;
- spelling, grammar, predictive writing, drafting, rewriting, tone adjustment, summarization, and context-aware assistance;
- intelligent digests, sender classification, meeting/calendar context, attachment filing, newsletter management, and mailbox/storage insights;
- secure-mail targets including OpenPGP, PGP/MIME, S/MIME, digital signatures, client-side encryption, eligible end-to-end protected workflows, and protected local/cache storage only where the implemented architecture supports the claim;
- Wardveil-backed phishing, suspicious-link, malicious-attachment, sender/authentication, spam, and account protection;
- Privacy Shield tracking/IP/remote-content protections, protected-message controls, private/disposable aliases, and provider-supported custom-domain addresses;
- organization policy, retention, administration, and distribution features where the configured provider and authorized GoreeCloud integration can support them;
- deep first-party integration with GoreeCloud Sync, Drive, Location, Backups, Identity, Wardveil Security, Privacy Shield, Everkeep, Mesh, Contacts, Calendar, Tasks, Notes/Memos, Notify, Search, and future approved GoreeCloud services.

See [FEATURES.md](FEATURES.md) for the capability inventory and state rules.

## Provider architecture

GoreeCloud Mail uses normalized provider contracts so Gmail-specific, Microsoft-specific, Yahoo-specific, IMAP-specific, SMTP-specific, or future provider-specific details do not dominate the shared product model.

Browser clients communicate through trusted GoreeCloud service boundaries rather than receiving reusable provider credentials. Provider adapters expose only capabilities the configured provider actually supports. Unsupported actions must fail clearly rather than being simulated or falsely presented as available.

External providers remain authoritative for mailbox contents, folders/labels, delivery state, account policy, mail transport, domain hosting, aliases, quotas, and provider-owned administration except where a provider explicitly delegates an operation through an authorized API or protocol.

## Security and privacy boundaries

Email content, HTML, links, attachments, provider responses, protocol data, sender metadata, and remote resources are untrusted input.

Credentials, OAuth codes, refresh tokens, app passwords, cryptographic keys, session material, and other reusable secrets must never be committed to this repository or exposed in browser-visible responses. Cross-user and cross-account references must fail closed.

Wardveil Security is the security authority for applicable Mail protection decisions. Privacy Shield governs privacy, consent, data minimization, user control, remote resources, tracking protection, intelligent-assistance context, and privacy-sensitive data flows. Everkeep governs continuity and preservation treatment. GoreeCloud Identity governs GoreeCloud identity/authentication/authorization boundaries. GoreeCloud Mesh governs authenticated policy-controlled cross-service coordination.

## Wardveil attachment scanning

GoreeCloud Mail's trusted attachment-delivery service requires Wardveil Scan before provider attachment bytes can become a downloadable cached object. Mail does not connect directly to ClamAV and does not reinterpret raw scanner output as an authoritative security verdict.

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

Passing source tests do not constitute production acceptance. Real-provider connectivity, target-host credential/key custody, production HTML sanitization, durable recovery, runtime hardening, native packaging, platform-system acceptance, and production-readiness validation remain separate requirements.

## License

License selection is pending final project approval.
