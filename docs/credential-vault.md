# Credential Vault

## Purpose

GoreeCloud Mail separates reusable provider credentials from ordinary application state. Provider-account metadata, synchronization state, OAuth state hashes, and credential-vault references may be stored in the application SQLite database. Reusable provider secrets do not belong there.

## Implementations

### In-memory development vault

`server/credential-vault.js` provides deterministic development semantics only. It is not persistent and is not approved for production use.

### Encrypted file vault

`server/encrypted-file-credential-vault.js` provides a controlled self-hosted encrypted-file adapter for provider credentials.

The adapter:

- encrypts the complete vault payload with AES-256-GCM;
- requires a 32-byte encryption key supplied by trusted runtime configuration;
- never writes the encryption key into the vault file;
- uses a fresh 96-bit IV for every persisted vault generation;
- authenticates ciphertext before decrypting it;
- stores only ciphertext, IV, authentication tag, format version, and algorithm identifier on disk;
- writes through a temporary file before atomic replacement;
- forces the resulting vault file to mode `0600`;
- keeps credentials scoped by GoreeCloud user and opaque provider-account identifier;
- exposes only non-secret descriptors through `describe()`;
- returns cloned secret objects rather than mutable internal references.

The application database should refer to entries through `provider_credential_refs.vault_key`. It must not duplicate the encrypted vault payload or reusable secret values into ordinary application tables.

## Key-management boundary

The encrypted-file adapter does not solve key custody by itself. The 32-byte encryption key remains a separate high-value secret and must be supplied by an approved runtime secret mechanism. It must not be committed to Git, written into ordinary documentation, embedded in application images, or stored beside the vault as plaintext.

A deployment is not production-accepted until key generation, delivery, permissions, backup, recovery, rotation, compromise response, and administrator access are explicitly validated for the target environment.

## Backup and recovery

Backing up the encrypted vault without preserving the encryption key is insufficient for recovery. Backing up the key together with the vault without independent protection weakens the separation boundary.

Production recovery therefore requires an independently protected key-recovery path and a tested restore procedure that proves:

1. the encrypted vault can be restored to the intended host;
2. the approved key can decrypt it;
3. file permissions remain restrictive after restore;
4. provider-account credential references still resolve correctly;
5. a wrong key fails authenticated decryption rather than producing usable plaintext;
6. no plaintext credential copies are introduced during backup or restore.

## Rotation direction

Future key rotation should decrypt the existing authenticated vault using the old key and immediately rewrite it under a new independently supplied key using a fresh IV. Rotation must be atomic and recoverable; a failed rotation must not destroy the only readable vault generation.

Provider token rotation and vault-encryption-key rotation are separate lifecycle operations and must not be conflated.

## Current acceptance state

The encrypted file vault is source-level security groundwork, not production secret-storage acceptance. Automated tests prove ciphertext-at-rest behavior, restrictive file mode, restart persistence, user/account isolation, authenticated-decryption failure with the wrong key, non-secret descriptor behavior, and durable removal.

Target-host secret injection, backup/recovery proof, key rotation, filesystem ownership, operational monitoring, and production acceptance remain pending.
