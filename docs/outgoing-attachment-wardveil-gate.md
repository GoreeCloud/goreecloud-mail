# Outgoing Gmail Attachment Wardveil Gate

## Development capability

GoreeCloud Mail's Gmail write path has an explicit fail-closed Wardveil Security boundary for messages that contain attachments.

The existing `buildGmailRawMessage` composition path remains the single authority for Gmail message and attachment syntax/size validation. Before a provider write is allowed, `GmailOutgoingAttachmentSecurityGate` validates the message through that builder, materializes the exact attachment bytes, and submits each attachment to the existing Wardveil Scan client contract.

Only a current, authoritative, exact-resource/digest-bound `clean` scan finding may proceed. The authorized message replaces attachment payloads with immutable byte buffers derived from the validated input, and `GmailAccountService` serializes those same buffers into the provider MIME write.

## Fail-closed behavior

Attachment writes are blocked before Gmail transport when:

- no outgoing Wardveil gate is configured;
- Wardveil Scan transport is unavailable;
- scan evidence is malformed or not authoritative;
- the response resource/digest binding does not match the bytes being written;
- evidence is expired or has an invalid validity window;
- a result is `malicious`, `suspicious`, `unknown`, or `unsupported`;
- minimized clean scan provenance cannot be durably persisted before provider-client creation.

A malicious result uses the existing non-destructive quarantine-required decision contract. This milestone does not implement deletion or destructive quarantine execution.

Messages without attachments retain the existing Gmail send/draft path and do not require attachment scanning.

## Write semantics

`send` uses Wardveil action `send`. Draft create/update uses action `draft`. Scanning and durable clean-provenance persistence both occur before Gmail client creation/provider write. The existing deterministic reconciliation Message-ID and ambiguous-write reconciliation behavior remains unchanged after provider submission; Wardveil failure never triggers a Gmail write.

Outgoing resource IDs are opaque SHA-256-derived identifiers bound to the account, optional client mutation ID, attachment position, and exact content digest. Raw attachment names/content and user identifiers are not embedded in the Wardveil resource identifier.

## Durable outgoing scan provenance

`server/outgoing-attachment-scan-provenance-store.js` records minimized application-side provenance for the accepted clean scan set before the write is allowed to reach Gmail. The record is operation-scoped rather than attachment-content storage: it preserves enough evidence to explain which current clean findings authorized a specific outgoing attachment write without persisting the attachment itself.

The sidecar uses schema version 1, is bounded to 128 KiB, is atomically written through a temporary file, and is created with file mode `0600` under a private configured provenance root. Its opaque operation identifier is SHA-256-derived and does not expose the raw account or user identifier.

For each clean attachment finding, the durable record stores only the Wardveil scan record ID, correlation ID, authoritative producer ID, observation time, validity deadline, exact content digest, opaque `mail:outgoing:<sha256>` resource ID, and bounded evidence references. It also stores the bounded lifecycle action (`send` or `draft`). It does not store attachment filenames, raw attachment bytes, recipient addresses, provider credentials/tokens, Wardveil caller secrets, message bodies, or unrestricted diagnostics.

A local SHA-256 integrity digest detects corruption or uncoordinated modification. It is not a production cryptographic signature, and this application-local record is not Wardveil Audit. Production authenticated provenance storage and centralized Wardveil Audit remain separate acceptance requirements.

If provenance persistence fails or returns an invalid acknowledgement, the write fails closed before Gmail client creation. A successful scan result without durable provenance is therefore insufficient to authorize an attachment-bearing provider write in this source milestone.

## Explicit limitations

This Development slice now implements immediate pre-write Wardveil clean enforcement plus durable minimized application provenance for outgoing attachment decisions. It does **not** establish Wardveil Audit persistence, production authenticated provenance-store acceptance, production Wardveil service availability/SLA, live Gmail provider acceptance with attachments, production GoreeCloud Identity service identity/key custody, distributed replay protection, quarantine execution, deployment, release, Stable qualification, or a broad Protected by Wardveil claim.
