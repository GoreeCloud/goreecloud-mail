# Browser compose attachment materialization

GoreeCloud Mail now has a browser-side attachment materialization primitive for the future authenticated provider compose surface.

## Contract

`web/compose-attachments.js` converts user-selected browser `File`-like objects into the message shape already accepted by the trusted Mail gateway and Gmail message builder:

```text
{
  filename,
  contentType,
  contentBase64
}
```

The materializer:

- preserves exact selected bytes when producing base64;
- rejects unsafe or overlong filenames;
- normalizes a valid simple MIME type to lowercase and otherwise uses `application/octet-stream` only when the browser supplies no type;
- enforces the same 20-file, 10 MiB per-file, and 20 MiB total bounds as the current Gmail message builder;
- checks the materialized byte length against the browser-declared size when one is available; and
- fails before returning a compose payload when a bound is violated.

## Security authority

These browser checks are usability and early-rejection controls only. They are **not** the security authority for outgoing mail.

For attachment-bearing Gmail send or draft writes, the trusted server path remains authoritative:

1. the Gmail message builder validates the complete message and exact attachment bytes;
2. Wardveil Scan receives those exact validated bytes;
3. current authoritative clean evidence is required;
4. minimized outgoing scan provenance must persist successfully; and
5. only then may the Gmail provider client be created for the write.

Malicious, suspicious, unknown, unsupported, unavailable, malformed, expired, binding-mismatched, or provenance-persistence-failed states remain blocking before the provider write.

## Activation boundary

The current Development web application is still demo-provider-backed. This materializer is deliberately **not** wired into the demo sender because doing so would create a visible attachment-send path that bypasses the trusted Wardveil-gated provider write boundary.

Activation requires the browser compose UI to use an authenticated `GatewayMailProvider` account end-to-end. Demo browsing and real provider sending must not be silently mixed.

## Acceptance boundary

This milestone establishes browser byte acquisition and server-compatible serialization only. It does not establish authenticated provider UI activation, real Gmail attachment interoperability, production OAuth custody, production Wardveil service acceptance, quarantine execution, release, deployment, or Stable qualification.
