# GoreeCloud Mail — Wardveil Attachment Scanning

GoreeCloud Mail treats every attachment as untrusted input until a current, authoritative Wardveil Scan result is bound to the exact attachment bytes and represented attachment scope.

## Integration boundary

Mail consumes Wardveil Scan. Mail does not connect directly to ClamAV, does not inherit scanner-specific configuration, and does not treat ClamAV as the product boundary.

The source-level flow is:

`provider attachment -> GoreeCloud Mail attachment identity -> Wardveil Scan -> validated scan finding -> Mail attachment decision -> optional Wardveil Quarantine handoff`

ClamAV may be one replaceable engine beneath Wardveil Scan, but Mail must remain engine-independent.

## Hardened Wardveil Scan transport

`server/wardveil-scan-client.js` is the Mail-side source implementation for the hardened Wardveil Scan transport introduced by Wardveil Security revision `842d792c128906e70d41028e3153ea527c1d1899`.

The client permits only explicit IPv4 loopback HTTP to `/v1/scan`, refuses redirects, and signs each request using the Wardveil 0.1.0 canonical request material. The signature binds caller ID, key ID, timestamp, nonce, action, resource type, resource ID, correlation ID, exact byte length, and SHA-256 digest. The default caller identity is `goreecloud-mail` and only `mail_attachment` scope is emitted by this client.

Responses must be bounded JSON, must bind the same resource identity and digest, and must return the same correlation ID. Mail accepts the canonical application envelope field `scan_record.result`; the older `scan_result` field is rejected rather than interpreted.

This HMAC-SHA256 transport is Foundation 0.9 reference-compatible source behavior. It is not accepted production GoreeCloud Identity service authentication, production signing-key lifecycle, or distributed replay protection.

## Attachment identity and digest binding

The consumer assigns the canonical resource type `mail_attachment` and resource identity:

`mail:<message_id>:attachment:<attachment_id>`

Before a scan result can affect Mail behavior, the integration computes SHA-256 over the attachment bytes and requires the Wardveil response envelope to carry the same digest. A result for a different resource or different content digest fails closed.

This prevents a clean result for one attachment from being reused for different bytes or a different message attachment.

## Result handling

### Clean

A clean result enables opening or downloading only when all of the following hold:

- Wardveil runtime contract version is supported;
- record type is `scan_finding`;
- the producer is explicitly authoritative;
- represented resource type and resource ID match the attachment;
- the content digest matches the exact attachment bytes;
- the canonical application record field is `result`;
- evidence references are present;
- `observed_at` is not future-dated;
- `valid_until` is later than `observed_at` and has not expired.

If any condition fails, Mail blocks opening and downloading and presents an unverified/degraded security state instead of treating the attachment as clean.

### Malicious

An authoritative malicious result bound to the same attachment digest blocks opening and downloading and creates a Wardveil Quarantine handoff request. The Mail consumer does not quarantine or delete the attachment by itself.

A malicious result remains blocking for the same immutable content digest after its original evidence validity window expires. Evidence expiry must never upgrade known-malicious content into an allowed attachment. A later authoritative clean rescan can supersede the prior state only through an explicit, current scan decision path.

### Suspicious

Suspicious content is held for review. It is not automatically promoted to confirmed malware and the reference consumer does not request quarantine solely from the suspicious result.

### Unknown or unsupported

Unknown and unsupported results fail closed. Mail does not allow the attachment to open or download merely because scanning was unavailable or unsupported.

## Quarantine handoff

The reference consumer can emit a bounded handoff containing the attachment scope, source scan record, and evidence references. The handoff explicitly requires an authorized Wardveil Quarantine executor and marks quarantine as non-destructive.

Quarantine is not deletion. Removal, release, or other destructive actions remain separate authorized Wardveil actions.

## Privacy Shield boundary

Mail must not copy raw attachment bytes, provider credentials, OAuth tokens, app passwords, cookies, Wardveil caller secrets, or unrestricted message content into shared Wardveil security records. Shared evidence should contain only the minimum identifiers, digests, status, timestamps, and references required for the security decision.

## Provider boundary

Gmail, IMAP, SMTP, or another provider remains responsible for provider-side message storage and transport state. A Wardveil decision controls GoreeCloud Mail behavior; it does not claim to have deleted or quarantined a provider-side object unless an explicitly authorized provider integration supplies corresponding evidence.

## Production acceptance

This implementation is an executable source-level GoreeCloud Mail consumer of Wardveil Scan, but production runtime status remains `unaccepted`.

Production acceptance still requires:

- deployment of the hardened Wardveil Scan service revision on the target runtime;
- a deployed Mail backend that executes this client against the deployed Wardveil service;
- GoreeCloud Identity-backed service identity, short-lived credentials, rotation, and revocation acceptance replacing reference HMAC custody;
- controlled clean, EICAR/malicious, suspicious, unsupported, timeout, scanner-unavailable, digest-mismatch, replay, revoked-credential, and stale-evidence tests;
- verified provider attachment retrieval and byte-for-byte digest binding;
- authorized Wardveil Quarantine execution evidence for supported Mail targets;
- user-visible Glaze UI states for allowed, held, blocked, quarantined, and unavailable scanning states;
- Privacy Shield validation for data minimization;
- Everkeep integration where attachment recovery or preservation behavior applies.

Passing repository CI proves source-level contract behavior only. It does not prove deployed malware protection or authorize a broad Protected by Wardveil claim.
