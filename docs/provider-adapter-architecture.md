# Courier Provider Adapter Architecture

## Purpose

GoreeCloud Mail uses provider adapters to prevent the application from becoming dependent on one email provider.

## Adapter Boundary

```
Courier Core
    |
    v
Provider Interface
    |
    +--> Gmail Adapter
    |
    +--> IMAP Adapter
    |
    +--> SMTP Adapter
```

## Responsibilities

A provider adapter handles:

- authentication flow
- mailbox discovery
- message retrieval
- message submission
- provider-specific synchronization behavior
- provider-specific error translation

## Non-Responsibilities

Adapters do not own:

- user interface behavior
- security decisions
- credential storage
- attachment rendering
- HTML trust decisions

## Credential Handling

Provider credentials and tokens must remain behind the secure backend boundary.

The UI must never directly manage long-lived provider credentials.

## Initial Providers

### Gmail

Planned support:

- OAuth authorization
- token refresh
- mailbox synchronization
- message sending

### IMAP / SMTP

Planned support:

- standards-based mailbox access
- standards-based sending
- configurable provider compatibility

## Future Expansion

Additional providers can be added without changing the Courier core mail model.
