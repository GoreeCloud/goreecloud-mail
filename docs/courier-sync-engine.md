# GoreeCloud Courier Synchronization Engine

## Purpose

The Courier Synchronization Engine provides the provider-independent synchronization layer for GoreeCloud Mail.

The engine allows GoreeCloud Mail to connect to approved external email providers while keeping provider-specific behavior isolated behind adapters.

## Design Goals

- Reliable incremental synchronization
- Offline-capable user experience
- Provider independence
- Recoverable local state
- Secure credential boundaries
- Clear synchronization status

## Architecture

```
Provider Adapter
       |
       v
Synchronization Coordinator
       |
       +--> Mailbox State
       |
       +--> Message Cache
       |
       +--> Attachment Metadata
       |
       +--> Operation Queue
       |
       v
Local Storage
```

## Provider Adapters

Initial adapters:

- Gmail API
- IMAP
- SMTP sending

Each provider adapter is responsible for translating provider-specific APIs into Courier's internal mail model.

## Synchronization Model

Courier uses incremental synchronization whenever the provider supports it.

Tracked state includes:

- provider account identifier
- mailbox identifier
- synchronization cursor
- last successful sync time
- pending operations
- failure state

## Operation Queue

User actions are represented as operations before provider confirmation.

Examples:

- Archive message
- Mark read
- Apply label
- Move message
- Send draft

Operations move through states:

```
Pending
  |
Processing
  |
Confirmed

or

Failed
```

## Offline Behavior

Offline clients may continue creating local drafts and queued actions.

The interface must clearly distinguish:

- local changes
- synchronization in progress
- completed provider changes
- failed synchronization

## Security Requirements

The synchronization engine must never:

- expose provider credentials to clients
- store secrets in logs
- trust incoming email content
- execute remote resources automatically

HTML, links, attachments, and metadata remain untrusted input.

## Future Integration

Courier synchronization will provide shared communication events for:

- GoreeCloud Contacts
- GoreeCloud Calendar
- GoreeCloud Tasks
- GoreeCloud Notes
- GoreeCloud Notify
- GoreeCloud Identity
