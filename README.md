# GoreeCloud Mail

Privacy-first, self-hosted GoreeCloud email client for web, Linux, and Android with provider-independent mail access, Glaze UI, and Wardveil Security.

## Status

Initial native repository foundation with the first executable Wardveil attachment-security consumer. Production deployment is not approved.

## Role

GoreeCloud Mail is the first-party email client and communication interface for GoreeCloud. It connects to approved external email providers and does **not** operate an email server.

## Planned clients

- Web
- Linux desktop
- Android
- iOS (long-term target)

## Core architecture

The application will use a provider-independent mail layer with initial support planned for Gmail APIs and standards-based IMAP/SMTP providers. The UI will use Glaze UI, security-sensitive experiences will use Wardveil Security, and privacy protections will align with GoreeCloud Privacy Shield.

## Wardveil attachment scanning

`reference/mail_attachment_security.py` is the first executable GoreeCloud Mail consumer of Wardveil Scan. It binds a Wardveil `scan_finding` to the exact attachment identity and SHA-256 content digest before Mail can use the result.

A clean result can enable opening or downloading only when the Wardveil record is authoritative, correctly scoped, evidence-backed, current, and unexpired. Suspicious attachments are held for review. Malicious attachments remain blocked and request an explicitly authorized Wardveil Quarantine handoff. Unknown, unsupported, mismatched, stale, or unverifiable scan evidence fails closed.

Mail never connects directly to ClamAV. ClamAV remains a replaceable engine beneath Wardveil Scan, preserving Wardveil Security as the GoreeCloud security product and policy boundary. See `docs/wardveil-attachment-scanning.md` and `contracts/wardveil.mail-attachment-scan.json`.

This is source-level integration evidence only. Production runtime acceptance still requires deployed Mail-to-Wardveil service communication, controlled scan tests, verified provider attachment retrieval, authorized quarantine execution, Glaze UI security states, Privacy Shield validation, and applicable Everkeep behavior.

## Planned integrations

- GoreeCloud Contacts
- GoreeCloud Calendar
- GoreeCloud Tasks
- GoreeCloud Notes / Memos
- GoreeCloud Notify
- GoreeCloud Identity

## Security boundary

Email content, HTML, links, attachments, and remote resources are untrusted input. Credentials, tokens, app passwords, and other secrets must never be committed to this repository or copied into shared Wardveil evidence.

## Validation

Run:

```bash
python3 scripts/test_mail_attachment_security.py
python3 scripts/validate_wardveil_mail_integration.py
```

Repository CI validates the attachment security mapping, digest/scope binding, evidence freshness, quarantine authority boundary, platform-integration contract, and Python compilation against the exact pull-request revision.

## License

License selection is pending final project approval.
