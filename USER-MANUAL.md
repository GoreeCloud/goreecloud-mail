# GoreeCloud Mail User Manual

## Current availability

GoreeCloud Mail is in **Active Development**. Production deployment and public Stable release are not approved. It is a GoreeCloud email **client**, not a GoreeCloud-operated mailbox provider. Your configured external provider remains authoritative for mailbox hosting and Internet mail delivery.

## Development access model

Current source includes a responsive web client and trusted provider backend foundations. Real-provider use requires an approved Development environment with the corresponding provider authorization configured by the operator. Do not expect a public sign-up or hosted `@goreecloud` mailbox service from the current application.

## Accounts and provider capabilities

GoreeCloud Mail uses provider-account connections rather than exposing reusable provider credentials to the browser. Available actions depend on the capabilities the external provider authorizes and the GoreeCloud adapter actually implements.

If an operation is unsupported, unavailable, or not authorized, GoreeCloud Mail should report that state rather than pretending it succeeded.

## Reading mail

The current Gmail foundation supports authenticated mailbox listing and normalized message reading through trusted backend boundaries. Provider HTML is untrusted; production HTML rendering remains gated until a maintained sanitizer is accepted. Remote-content privacy controls are governed by Privacy Shield.

## Attachments

Provider attachment bytes are treated as untrusted input. Where the current cached attachment-delivery path is used, GoreeCloud Mail requires a current authoritative Wardveil Scan clean result bound to the exact content before a cached object becomes downloadable. Malicious, suspicious, unknown, unsupported, expired, invalid, or scanner-unavailable results fail closed.

Do not interpret a source-level attachment workflow as production scanning acceptance; runtime deployment and production security evidence remain separate gates.

## Sending mail

The current Gmail source supports a bounded plain-text send foundation. At least one recipient is required, header/body sizes are bounded, unsafe header characters are rejected, and Gmail write operations are not automatically retried.

A caller may use a stable client mutation identifier for send reconciliation. If Gmail returns an ambiguous temporary failure after the single send attempt, GoreeCloud Mail can search the Sent mailbox for the server-generated RFC Message-ID instead of replaying the write. Exactly one matching message confirms the send. If the outcome cannot be confirmed, the application returns a non-retryable provider-write-outcome-unknown state so generic retry logic does not accidentally send a duplicate.

This is Development source behavior. Real Gmail timing/search-consistency acceptance is still required before production claims.

## Drafts

The current Gmail source supports bounded plain-text draft creation and replacement. Draft create/update writes remain one-attempt operations. Ambiguous draft-write reconciliation is not yet complete, so the application must not imply that a failed response proves the provider did not create or update a draft.

## Sender identities and rich composition

Arbitrary caller-provided From identities fail closed unless a provider-confirmed sender-identity capability is implemented and authorized. Rich HTML composition, outgoing attachments, multipart MIME, signatures, inline images, templates, and advanced sender-identity workflows remain separate milestones unless later source/documentation explicitly marks them implemented.

## Privacy and security expectations

- Provider credentials and refresh tokens belong in trusted backend custody, not browser-visible state.
- Mail content, links, HTML, attachments, sender metadata, and provider responses are untrusted input.
- Privacy Shield governs remote-content/privacy-sensitive flows.
- Wardveil Security governs applicable security decisions.
- GoreeCloud Identity governs GoreeCloud authentication/authorization boundaries.
- Everkeep governs accepted continuity, backup, recovery, preservation, and portability behavior.
- GoreeCloud Mesh governs authenticated cross-service coordination.

## Current limitations

The Development repository does not establish production provider connectivity, production OAuth consent/verification, complete sender identities, rich composer parity, durable offline operation journals, production HTML sanitization, complete native Android/iOS/Linux packaging, signed release distribution, or Stable qualification.

Refer to `README.md`, `SPECIFICATIONS.md`, `FEATURES.md`, and the `docs/` directory for implementation and acceptance details.
