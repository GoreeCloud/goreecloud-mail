# Courier Core Domain Model

## Purpose

This document defines the internal data model for GoreeCloud Mail (Courier). The model separates provider-specific email systems from the GoreeCloud application layer.

## Core Entities

### User

Represents an authenticated GoreeCloud user.

Fields:

- id
- identity reference
- preferences
- security settings
- notification settings

### ProviderAccount

Represents a connected external mail provider.

Fields:

- id
- provider type
- display name
- authorization state
- encrypted credential reference
- sync status

Secrets are never stored directly in application records.

### Mailbox

Represents a synchronized mail container.

Examples:

- Inbox
- Sent
- Drafts
- Archive
- Custom labels/folders

Fields:

- id
- provider account
- remote identifier
- name
- capabilities

### Thread

Represents a conversation grouping.

Fields:

- id
- participants
- subject
- message count
- timestamps
- read state

### Message

Represents an individual email message.

Fields:

- id
- thread reference
- sender
- recipients
- headers
- body representation
- provider identifier
- timestamps
- security classification

Email content is treated as untrusted input.

### Attachment

Represents message attachments.

Fields:

- id
- message reference
- filename
- media type
- size
- storage reference
- security scan state

### SyncCursor

Tracks provider synchronization progress.

Fields:

- provider account
- mailbox
- cursor value
- last successful sync
- error state

### QueuedOperation

Represents local actions awaiting provider confirmation.

Examples:

- send message
- archive message
- move message
- delete message
- mark read

States:

- pending
- processing
- completed
- failed
- retrying

## Design Principles

- Provider independence
- Offline-capable operation
- Explicit synchronization state
- Recoverable application data
- No credential leakage
- Security-first email handling
