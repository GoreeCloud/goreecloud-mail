# Security Policy

GoreeCloud Mail treats messages, HTML, links, attachments, provider responses, and remote resources as untrusted input.

## Sensitive information

Do not commit passwords, OAuth client secrets, refresh tokens, API keys, app passwords, private keys, session material, mailbox exports, or private message content.

## Security boundaries

- Provider credentials must be stored outside the repository.
- HTML message rendering must pass through a sanitization boundary before production use.
- Remote content must not load automatically unless the approved privacy policy allows it.
- Account and user data must remain isolated.
- Attachments must never execute automatically.
- Logs must not contain credentials or unnecessary message content.

## Reporting

Security issues should be reported privately to the GoreeCloud administrator rather than disclosed through public issue content.
