# SQLite Migration, Backup, and Recovery Contract

## Purpose

GoreeCloud Mail treats its SQLite application database as recoverable application state, not as a place for reusable provider secrets. Provider account metadata, vault references, hashed OAuth state, synchronization cursors, mailbox synchronization state, and operation-idempotency state may live in SQLite. Gmail refresh tokens, IMAP/SMTP passwords, application passwords, and other reusable provider credentials remain in the separate credential-vault boundary.

## Schema versioning

`server/sqlite-migrations.js` defines the repository-owned ordered migration list. Migration versions are monotonically increasing integers and are recorded in `schema_migrations` only after the migration transaction succeeds.

The initial durable schema is version 1 (`baseline-mail-state`). The baseline uses idempotent DDL so databases created before the migration framework can be adopted without dropping or recreating existing application tables.

Future schema changes must be represented as a new migration version. A previously released migration must not be silently rewritten to mean something different after deployment.

## Migration safety

Each pending migration runs inside `BEGIN IMMEDIATE`. If any migration statement fails, the transaction is rolled back and that version must not be represented as applied.

A deployment must back up and verify the application database before applying a migration that can materially alter persistent state. Destructive migration behavior requires explicit recovery planning and acceptance evidence.

## Backup creation

`server/sqlite-backup.js` creates a consistent SQLite snapshot using `VACUUM INTO`. The backup destination must differ from the source and must not already exist, preventing accidental overwrite of a prior recovery point.

A WAL checkpoint is requested before snapshot creation. The resulting backup is immediately subjected to SQLite `PRAGMA integrity_check` and its repository schema version is reported.

Backups contain application database state only. They do not contain the encryption key for the credential vault and are not sufficient by themselves to recover reusable provider credentials.

## Recovery verification

A backup is not considered usable merely because a file exists. Recovery validation must verify at minimum:

1. SQLite reports `integrity_check = ok`.
2. The schema version is known and supported by the deployed GoreeCloud Mail build.
3. Provider-account and synchronization records expected for the recovery scenario can be read after restore.
4. Cross-user isolation remains intact after restore.
5. Credential-vault references still resolve only when the separately protected vault and its key are also available.

Production acceptance additionally requires a controlled restore rehearsal on the target filesystem and runtime.

## File protection

Production database and backup locations must use GoreeCloud-approved ownership and restrictive permissions. Backup directories must not be exposed through the web application, static hosting, public Caddy paths, or source control.

The database may contain account identifiers, synchronization metadata, and other private operational information even though reusable provider secrets are excluded.

## Retention and lifecycle

Retention must follow the approved GoreeCloud backup, privacy, and data-protection policies. Old backups must not be retained indefinitely without a defined purpose. Deletion of a provider account must eventually be reflected in backup-retention and recovery procedures so an obsolete backup cannot become an unintended long-term source of private application state.

## Production acceptance still pending

This source foundation does not by itself approve production persistence. Before production use, GoreeCloud Mail still requires target-host proof for database ownership and permissions, backup destination selection, automated backup scheduling where approved, restore rehearsal, migration rollback/recovery procedure, corruption response, monitoring, storage-capacity handling, and integration with the wider GoreeCloud backup strategy.
