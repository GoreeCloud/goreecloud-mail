# Courier Provider Interface Contracts

## Purpose

Defines the contract between Courier Core and external email providers.

Courier Core must not depend on Gmail, IMAP, SMTP, or any single provider implementation.

## Provider Adapter

Each provider adapter implements:

- authentication
- mailbox discovery
- message retrieval
- incremental synchronization
- message mutation
- sending
- attachment retrieval

## MailProvider Interface

Conceptual interface:

```
connect()
disconnect()
validateCredentials()
listMailboxes()
syncMailbox()
fetchMessage()
sendMessage()
updateMessageState()
``` 

## Authentication Boundary

Provider authentication must be isolated.

Supported methods:

- OAuth
- application passwords where required
- future provider-specific authentication

Rules:

- credentials never committed to source control
- tokens stored only through secure credential storage
- logs must never contain secrets

## Gmail Adapter

Future implementation:

- OAuth authorization
- Gmail API integration
- label synchronization
- history-based incremental sync
- message send support

## IMAP Adapter

Future implementation:

- standards-based mailbox access
- UID synchronization
- folder discovery
- message retrieval

## SMTP Adapter

Future implementation:

- outbound message delivery
- authentication handling
- send status reporting

## Error Model

Provider errors must be normalized into Courier states:

- authentication_required
- authorization_expired
- provider_unavailable
- network_failure
- rate_limited
- invalid_message

## Expansion Goal

New providers should be added by creating adapters, not modifying Courier Core.
