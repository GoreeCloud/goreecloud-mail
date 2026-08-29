# GoreeCloud Mail

GoreeCloud Mail is GoreeCloud's privacy-first, first-party email client platform for web and planned native clients. It connects to compatible external mail providers through trusted GoreeCloud provider adapters; GoreeCloud does **not** currently operate mailbox hosting, MX infrastructure, or Internet mail-delivery infrastructure.

## Status

**Active Development. Production deployment is not approved. Stable release is not approved.**

External providers remain authoritative for mailbox hosting, mailbox contents, delivery state, quotas, provider-owned policy, and Internet mail transport except where they explicitly delegate an operation through an authorized API or protocol.

## Current source foundation

The repository currently includes:

- responsive Glaze UI web/client foundations;
- provider-independent Mail contracts and same-origin provider gateway boundaries;
- Gmail and standards-based IMAP/SMTP adapter foundations;
- trusted session-derived GoreeCloud user identity and user-scoped provider-account handling;
- OAuth state, Gmail PKCE/OAuth construction, token refresh/revocation, capability resolution, and normalized provider errors;
- bounded provider timeout/retry/backoff policy for replay-safe operations;
- SQLite-backed provider-account, credential-reference, synchronization, operation, and attachment metadata foundations;
- encrypted provider credential-vault source with AES-256-GCM and key-rotation support;
- fail-closed HTML message policy pending production sanitizer acceptance;
- Privacy Shield remote-content defaults;
- Wardveil-gated cached attachment delivery with exact-content binding and minimized clean-scan provenance;
- Gmail mailbox/label/message read foundations;
- bounded plain-text Gmail send, draft-create, and draft-update transport;
- one-attempt Gmail writes so non-idempotent provider writes are not automatically replayed; and
- **ambiguous Gmail send and draft-write reconciliation** using a server-owned deterministic RFC Message-ID and bounded provider lookup. Confirmed matches return reconciled metadata; unresolved outcomes fail closed as non-retryable `provider-write-outcome-unknown` rather than risking an automatic duplicate send or draft write.

Synthetic provider tests validate source contracts without representing a real mailbox as production-connected.

## Product role

GoreeCloud Mail owns the GoreeCloud client experience, local/trusted-backend logic, privacy controls, security integration, synchronization behavior, intelligent-assistance boundaries, and wider GoreeCloud interoperability while compatible external providers remain the mail-service authority.

**GoreeCloud Courier** is the unified first-party mail technology and feature framework powering GoreeCloud Mail. Courier is not a separate application, provider, or repository.

## Current write boundary

The Gmail composition foundation is intentionally bounded. It currently supports plain-text message construction with validated recipients and headers, optional trusted From/Reply-To fields where capabilities permit, and one-attempt Gmail API writes.

When a stable client mutation identifier is supplied, send and draft create/update operations use a server-owned deterministic RFC Message-ID for post-failure reconciliation. Ambiguous send is checked against the Sent mailbox. Ambiguous draft create/update is checked against a bounded Gmail draft search, and an update is accepted only when the unique matching provider draft is the exact draft ID being replaced. No ambiguous write is automatically replayed.

Durable cross-process operation journals, real Gmail timing/search-consistency acceptance, rich MIME/outgoing attachments, production sender identities, offline replay UX, and production credential custody remain separate milestones.

## Wardveil attachment scanning

GoreeCloud Mail's trusted cached attachment-delivery path requires Wardveil Scan before provider attachment bytes can become a downloadable cached object. Mail does not connect directly to ClamAV and does not reinterpret raw scanner output as an authoritative application verdict.

Only current authoritative clean evidence with the required exact-resource, correlation, validity, evidence-reference, and SHA-256 content binding may proceed. Malicious, suspicious, unknown, unsupported, invalid, expired, changed-content, or scanner-unavailable outcomes fail closed before downloadable storage. A malicious outcome may expose a bounded quarantine-required state; Mail is not the Wardveil Quarantine executor and quarantine is not deletion.

Minimized durable clean-scan provenance may survive service restart when it remains current and content-bound. Missing, corrupt, tampered, expired, or mismatched provenance fails closed. This remains source-validated application state rather than production Wardveil runtime acceptance or Wardveil Audit.

## Security and privacy boundaries

Mail content, HTML, links, attachments, provider responses, protocol data, sender metadata, and remote resources are untrusted input. Reusable provider credentials, refresh tokens, app passwords, cryptographic keys, session material, and other secrets must remain in trusted custody and must not be exposed through browser responses or committed to source.

- **Wardveil Security / Security Center** governs applicable security decisions such as attachment security evidence.
- **Privacy Shield / Privacy Center** governs privacy, consent, remote resources, tracking protection, data minimization, and user control.
- **Everkeep / Continuity Center** governs accepted backup, recovery, preservation, portability, and continuity behavior.
- **GoreeCloud Identity / Identity Center** governs GoreeCloud authentication and authorization boundaries.
- **GoreeCloud Mesh / Mesh Center** governs authenticated, policy-controlled cross-service coordination.
- **Glaze UI / Design Center** governs the approved interface/design-system contract for applicable clients.

Passing source tests does not establish production acceptance for any of these systems.

## Planned client surfaces

- Web
- Linux desktop
- Android
- iOS

Native packaging and representative-device acceptance remain incomplete unless a later release record explicitly states otherwise.

## Documentation

- [USER-MANUAL.md](USER-MANUAL.md)
- [SPECIFICATIONS.md](SPECIFICATIONS.md)
- [FEATURES.md](FEATURES.md)
- [BENEFITS.md](BENEFITS.md)
- [COMPETITIVE-OBJECTIVES.md](COMPETITIVE-OBJECTIVES.md)
- [docs/courier.md](docs/courier.md)
- [docs/provider-backend-contract.md](docs/provider-backend-contract.md)
- [docs/gmail-write-transport.md](docs/gmail-write-transport.md)
- [docs/wardveil-attachment-scanning.md](docs/wardveil-attachment-scanning.md)
- [docs/database-maintenance.md](docs/database-maintenance.md)
- [docs/credential-vault.md](docs/credential-vault.md)

## Validation

Run the source suites with:

```bash
npm test
npm run test:backend
```

GitHub Actions also runs repository validation and static safety checks. Material backend/security candidates require exact-head validation before merge.

Source validation is not production deployment, real-provider acceptance, signed release, or Stable qualification.

## License

License selection is pending final project approval.
