# GoreeCloud Mail — Wardveil Runtime Application-Consumer Acceptance

## Purpose

This target-environment command advances GoreeCloud Mail from source-only Wardveil attachment enforcement toward deployed application-consumer evidence. It exercises the real Mail incoming attachment-delivery service, Gmail account service, outgoing Wardveil security gate, exact MIME construction path, and durable application provenance stores against a live Wardveil Scan endpoint.

The command intentionally uses a **controlled provider boundary**. Provider attachment retrieval and provider send/draft writes are non-networked controls implemented inside the acceptance harness. This proves whether Mail admits or blocks provider-facing behavior after live Wardveil decisions without requiring or simulating a real Gmail mailbox write.

**Real Gmail provider execution remains unproven. Production runtime acceptance remains unaccepted. No broad Protected by Wardveil claim is authorized by this command.**

## Accepted scope when the target run passes

The runtime matrix requires all of the following:

- incoming clean provider bytes are scanned through live Wardveil before downloadable storage;
- incoming clean bytes can be authorized for download only after the exact stored bytes and current durable clean provenance are accepted;
- incoming clean provenance is persisted with mode `0600` and coordinated cleanup succeeds;
- incoming EICAR is blocked as `wardveil-scan-blocked` before any downloadable cache or clean provenance is created;
- outgoing send clean bytes pass through `GmailAccountService` and `GmailOutgoingAttachmentSecurityGate`, are scanned through live Wardveil, are durably recorded, and the exact authorized bytes are present in the controlled provider MIME;
- outgoing draft clean bytes pass through the same application boundary with action `draft` and durable clean provenance;
- outgoing send EICAR is blocked before provider-client creation and before provider write;
- outgoing draft EICAR is blocked before provider-client creation and before provider write;
- blocked content does not create clean outgoing provenance; and
- sanitized evidence contains no raw attachment content, provider credentials, or Wardveil caller secret.

The controlled cases use the real GoreeCloud Mail application services. The provider adapter is intentionally non-networked so this evidence cannot be mistaken for Gmail interoperability or mailbox-production acceptance.

## Preconditions

Run only from an exact GoreeCloud Mail source revision intended for target acceptance.

The target host must separately establish:

- `wardveil-scan.service` is active;
- the expected exact Wardveil Scan release is deployed;
- Wardveil Scan is reachable only at the approved loopback endpoint, normally `http://127.0.0.1:8791/v1/scan`;
- the protected Wardveil caller registry contains an active `goreecloud-mail` caller with key `scan-current` and `mail_attachment` scope;
- the Mail caller secret file matches that protected caller entry; and
- Node.js 22 or newer is available.

The **caller secret** must be a root-owned regular non-symlink file with mode `0400` or `0600`. The command never prints the secret and excludes it from sanitized evidence.

## Command

Example target invocation:

```bash
sudo node scripts/run-mail-wardveil-runtime-acceptance.mjs \
  --secret-file /etc/goreecloud/mail/wardveil-scan.secret \
  --mail-revision '<exact-mail-revision>' \
  --wardveil-revision '<exact-deployed-wardveil-revision>' \
  --endpoint 'http://127.0.0.1:8791/v1/scan' \
  --caller-id 'goreecloud-mail' \
  --key-id 'scan-current' \
  --output "/opt/goreecloud/mail/wardveil-acceptance/evidence/<exact-mail-revision>.json"
```

The output path is created exclusively with mode `0600`; an existing evidence file is not overwritten. Operators should verify exact source/release identity outside the process before invoking the command and should promote or copy sanitized evidence only through the approved GoreeCloud evidence workflow.

## Successful console boundary

A successful run prints only status metadata such as:

```text
runtime_application_consumer_matrix=passed
incoming_clean_download=passed
incoming_eicar_blocked=passed
outgoing_send_clean_admitted=passed
outgoing_send_eicar_blocked=passed
outgoing_draft_clean_admitted=passed
outgoing_draft_eicar_blocked=passed
real_gmail_provider_execution=not_proven
production_runtime_acceptance=unaccepted
```

No attachment bytes, recipient addresses, provider credentials, Wardveil caller secret, or reusable authorization material belongs in the acceptance console or evidence.

## Evidence boundary

Sanitized evidence records the exact Mail revision, exact Wardveil revision supplied by the verified target wrapper, endpoint, matrix results, provenance-permission checks, and explicit non-claims.

A passing application-consumer matrix does **not** establish:

- real Gmail attachment retrieval;
- real Gmail send, draft creation, or draft update;
- Gmail provider byte-binding/interoperability acceptance;
- production OAuth consent, sender identity, credential custody, or token lifecycle;
- production GoreeCloud Identity service identity or signing-key lifecycle;
- revoked-credential runtime behavior;
- stale-signature runtime behavior;
- capacity/concurrency exhaustion behavior;
- multi-host replay protection;
- authorized Wardveil Quarantine execution/readback;
- authoritative Wardveil Audit or Security Center provenance;
- Privacy Shield runtime acceptance;
- Everkeep recovery treatment;
- Stable qualification; or
- overall Wardveil production runtime acceptance.

Those gates require their own exact-environment evidence and must remain visible as unproven until completed.
