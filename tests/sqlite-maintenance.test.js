import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { SqliteMailState } from '../server/sqlite-state.js';
import { applySqliteMigrations, currentSqliteSchemaVersion } from '../server/sqlite-migrations.js';
import { createSqliteBackup, verifySqliteBackup } from '../server/sqlite-backup.js';

function withTempDir(callback) {
  const dir = mkdtempSync(join(tmpdir(), 'goreecloud-mail-maintenance-'));
  try { return callback(dir); }
  finally { rmSync(dir, { recursive: true, force: true }); }
}

test('migration framework initializes an empty SQLite database exactly once', () => {
  withTempDir((dir) => {
    const path = join(dir, 'empty.sqlite3');
    const db = new DatabaseSync(path);
    const first = applySqliteMigrations(db, { now: () => '2026-08-21T13:00:00.000Z' });
    assert.equal(first.currentVersion, 2);
    assert.deepEqual(first.newlyApplied, [1, 2]);

    const second = applySqliteMigrations(db, { now: () => '2026-08-21T14:00:00.000Z' });
    assert.equal(second.currentVersion, 2);
    assert.deepEqual(second.newlyApplied, []);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get().count, 2);
    assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='attachment_delivery_records'").get());
    db.close();
  });
});

test('existing SqliteMailState databases report the current schema version', () => {
  withTempDir((dir) => {
    const path = join(dir, 'mail.sqlite3');
    const state = new SqliteMailState({ path });
    state.close();

    const db = new DatabaseSync(path, { readOnly: true });
    assert.equal(currentSqliteSchemaVersion(db), 2);
    db.close();
  });
});

test('SQLite backup preserves account state and passes integrity verification', () => {
  withTempDir((dir) => {
    const sourcePath = join(dir, 'mail.sqlite3');
    const backupPath = join(dir, 'backup', 'mail-2026-08-21.sqlite3');
    const state = new SqliteMailState({ path: sourcePath });
    const account = state.createProviderAccount({
      userId: 'user-a', provider: 'gmail', externalAccountId: 'primary', displayName: 'Primary Gmail',
    });
    state.putCursor({
      userId: 'user-a', accountId: account.id, provider: 'gmail', cursorType: 'history-id', cursorValue: '321',
    });
    state.putAttachmentDeliveryRecord({
      userId: 'user-a', accountId: account.id, objectId: 'object-a', messageId: 'message-a', attachmentId: 'attachment-a',
      filename: 'invoice.pdf', mimeType: 'application/pdf', sniffedMimeType: 'application/pdf', size: 7,
      sha256: 'a'.repeat(64), createdAt: '2026-08-21T13:00:00.000Z', expiresAt: '2026-08-22T13:00:00.000Z',
    });
    state.close();

    const created = createSqliteBackup({ sourcePath, backupPath });
    assert.equal(created.integrity, 'ok');
    assert.equal(created.schemaVersion, 2);

    const verified = verifySqliteBackup({ path: backupPath });
    assert.equal(verified.integrity, 'ok');

    const restored = new SqliteMailState({ path: backupPath });
    assert.equal(restored.getProviderAccountForUser('user-a', account.id).displayName, 'Primary Gmail');
    assert.equal(restored.getCursor({ userId: 'user-a', accountId: account.id, cursorType: 'history-id' }).cursorValue, '321');
    assert.equal(restored.getAttachmentDeliveryRecord({ userId: 'user-a', objectId: 'object-a' }).filename, 'invoice.pdf');
    restored.close();
  });
});

test('backup refuses destructive source overwrite and existing destinations', () => {
  withTempDir((dir) => {
    const sourcePath = join(dir, 'mail.sqlite3');
    const state = new SqliteMailState({ path: sourcePath });
    state.close();

    assert.throws(() => createSqliteBackup({ sourcePath, backupPath: sourcePath }), /must differ/);
    const backupPath = join(dir, 'backup.sqlite3');
    createSqliteBackup({ sourcePath, backupPath });
    assert.throws(() => createSqliteBackup({ sourcePath, backupPath }), /already exists/);
  });
});
