# Outgoing Gmail Attachment Wardveil Gate

## Development capability

GoreeCloud Mail's Gmail write path now has an explicit fail-closed Wardveil Security boundary for messages that contain attachments.

The existing `buildGmailRawMessage` composition path remains the single authority for Gmail message and attachment syntax/size validation. Before a provider write is allowed, `GmailOutgoingAttachmentSecurityGate` validates the message through that builder, materializes the exact attachment bytes, and submits each attachment to the existing Wardveil Scan client contract.

Only a current, authoritative, exact-resource/digest-bound `clean` scan finding may proceed. The authorized message replaces attachment payloads with immutable byte buffers derived from the validated input, and `GmailAccountService` serializes those same buffers into the provider MIME write.

## Fail-closed behavior

Attachment writes are blocked before Gmail transport when:

- no outgoing Wardveil gate is configured;
- Wardveil Scan transport is unavailable;
- scan evidence is malformed or not authoritative;
- the response resource/digest binding does not match the bytes being written;
- evidence is expired or has an invalid validity window;
- a result is `malicious`, `suspicious`, `unknown`, or `unsupported`.

A malicious result uses the existing non-destructive quarantine-required decision contract. This milestone does not implement deletion or destructive quarantine execution.

Messages without attachments retain the existing Gmail send/draft path and do not require attachment scanning.

## Write semantics

`send` uses Wardveil action `send`. Draft create/update uses action `draft`. Scanning occurs before Gmail client creation/provider write. The existing deterministic reconciliation Message-ID and ambiguous-write reconciliation behavior remains unchanged after provider submission; Wardveil failure never triggers a Gmail write.

Outgoing resource IDs are opaque SHA-256-derived identifiers bound to the account, optional client mutation ID, attachment position, and exact content digest. Raw attachment names/content and user identifiers are not embedded in the Wardveil resource identifier.

## Explicit limitations

This Development slice enforces immediate pre-write Wardveil clean evidence but does **not** yet durably persist outgoing scan provenance/audit records. It also does not establish production Wardveil service availability/SLA, live Gmail provider acceptance with attachments, deployment, production OAuth custody, quarantine execution, release, or Stable qualification.
