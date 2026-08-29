# Sanitized rich Gmail composition

## Development boundary

This milestone extends the existing trusted Gmail send/draft message builder with bounded `multipart/alternative` composition. It is a source-level composition capability, not production Gmail acceptance and not a general HTML-email execution surface.

When the caller supplies both a plain-text body and an HTML body, Mail:

- preserves the plain-text body as the accessibility/interoperability fallback;
- passes the HTML body through the existing restrictive first-party message sanitizer before MIME construction;
- emits deterministic `text/plain` and `text/html` UTF-8 parts under `multipart/alternative`;
- normalizes generated body line endings to CRLF;
- keeps the existing recipient/header-injection protections and Gmail write reconciliation Message-ID behavior; and
- enforces separate one-megabyte source limits for the plain-text and HTML bodies before provider submission.

## Security and privacy behavior

The outgoing HTML sanitizer is intentionally restrictive. It removes executable or embedding containers such as script, iframe, object, embed, SVG, MathML, forms and templates; removes event-handler and inline-style attributes; removes automatically loaded remote-resource attributes such as `src`, `srcset`, `background`, and `poster`; and permits only the existing bounded safe-link schemes on `href`.

This design prevents the rich-composition milestone from turning GoreeCloud Mail into a browser-like active-content generator. It also avoids silently adding tracking pixels or remote images through this path.

The sanitization boundary is not a claim that arbitrary HTML can be made harmless in every downstream mail client. Recipients and external providers remain outside GoreeCloud's rendering authority. Production acceptance must still verify real-provider MIME preservation and representative recipient-client behavior.

## Explicitly not included

This milestone does not implement outgoing file attachments, inline/embedded images, CSS styling, rich editor UI controls, signatures, templates, provider-confirmed sender identities, S/MIME, OpenPGP/PGP-MIME, production OAuth/credential custody, real Gmail acceptance, delivery acceptance, release acceptance, or Stable qualification.
