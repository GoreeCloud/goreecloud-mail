# GoreeCloud Mail

Privacy-first, self-hosted GoreeCloud email client for web, Linux, and Android with provider-independent mail access, Glaze UI, and Wardveil Security.

## Status

Initial repository foundation. Production deployment is not approved.

## Role

GoreeCloud Mail is the first-party email client and communication interface for GoreeCloud. It connects to approved external email providers and does **not** operate an email server.

## Planned clients

- Web
- Linux desktop
- Android
- iOS (long-term target)

## Core architecture

The application will use a provider-independent mail layer with initial support planned for Gmail APIs and standards-based IMAP/SMTP providers. The UI will use Glaze UI, security-sensitive experiences will use Wardveil Security, and privacy protections will align with GoreeCloud Privacy Shield.

## Planned integrations

- GoreeCloud Contacts
- GoreeCloud Calendar
- GoreeCloud Tasks
- GoreeCloud Notes / Memos
- GoreeCloud Notify
- GoreeCloud Identity

## Security boundary

Email content, HTML, links, attachments, and remote resources are untrusted input. Credentials, tokens, app passwords, and other secrets must never be committed to this repository.

## License

License selection is pending final project approval.
