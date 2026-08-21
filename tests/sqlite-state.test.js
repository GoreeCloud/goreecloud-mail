import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SqliteMailState } from '../server/sqlite-state.js';
import { ProviderAccountNotFoundError } from '../server/provider-account-registry.js';
import { SyncStateNotFoundError } from '../server/sync-state-store.js';
import { IdempotencyConflictError } from '../server/idempotency-store.js';

function withDatabase(callback) {
  const dir = mkdtempSync(join(tmpdir(), 'goreecloud-mail-'));
  const path = join(dir, 'mail.sqlite3');
  try {
    return callback({ path });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('SQLite provider accounts persist across process-style reopen and stay user-scoped', () => {
  withDatabase(({ path }) => {
    const first = new SqliteMailState({ path });
    const account = first.createProviderAccount({
      userId: 'user-a',
      provider: 'gmail',
      externalAccountId: 'external-a',
      displayName: 'Primary Gmail',
    });
    first.close();

    const second = new SqliteMailState({ path });
    assert.equal(second.getProviderAccountForUser('user-a', account.id).displayName, 'Primary Gmail');
    assert.throws(
      () => second.getProviderAccountForUser('user-b', account.id),
      ProviderAccountNotFoundError,
    );
    second.close();
  });
});

test('SQLite synchronization state persists and preserves last successful sync across failure', () => {
  withDatabase(({ path }) => {
    let state = new SqliteMailState({ path });
    const account = state.createProviderAccount({ userId: 'user-a', provider: 'gmail' });
    state.putCursor({
      userId: 'user-a',
      accountId: account.id,
      provider: 'gmail',
      cursorType: 'history-id',
      cursorValue: '100',
    });
    state.recordMailboxSuccess({
      userId: 'user-a',
      accountId: account.id,
      mailboxId: 'INBOX',
      syncedAt: '2026-08-21T10:00:00.000Z',
    });
    state.recordMailboxAttempt({
      userId: 'user-a',
      accountId: account.id,
      mailboxId: 'INBOX',
      errorCode: 'temporary-provider-failure',
      attemptedAt: '2026-08-21T10:05:00.000Z',
    });
    state.close();

    state = new SqliteMailState({ path });
    assert.equal(state.getCursor({
      userId: 'user-a', accountId: account.id, cursorType: 'history-id',
    }).cursorValue, '100');
    const mailbox = state.getMailboxState({
      userId: 'user-a', accountId: account.id, mailboxId: 'INBOX',
    });
    assert.equal(mailbox.lastSuccessfulSyncAt, '2026-08-21T10:00:00.000Z');
    assert.equal(mailbox.lastErrorCode, 'temporary-provider-failure');
    assert.throws(
      () => state.getMailboxState({ userId: 'user-b', accountId: account.id, mailboxId: 'INBOX' }),
      SyncStateNotFoundError,
    );
    state.close();
  });
});

test('SQLite idempotency state rejects incompatible key reuse and persists completed results', () => {
  withDatabase(({ path }) => {
    let state = new SqliteMailState({ path });
    const account = state.createProviderAccount({ userId: 'user-a', provider: 'gmail' });
    const scope = {
      userId: 'user-a',
      accountId: account.id,
      operation: 'archive',
      key: 'op-1',
    };

    state.beginIdempotentOperation({ ...scope, fingerprint: 'fingerprint-a' });
    assert.throws(
      () => state.beginIdempotentOperation({ ...scope, fingerprint: 'fingerprint-b' }),
      IdempotencyConflictError,
    );
    state.completeIdempotentOperation({ ...scope, result: { archived: true, ids: ['m1'] } });
    state.close();

    state = new SqliteMailState({ path });
    const completed = state.getIdempotentOperation(scope);
    assert.equal(completed.status, 'completed');
    assert.deepEqual(completed.result, { archived: true, ids: ['m1'] });
    completed.result.ids.push('mutated');
    assert.deepEqual(state.getIdempotentOperation(scope).result, { archived: true, ids: ['m1'] });
    state.close();
  });
});

test('SQLite transaction rolls back synchronization and idempotency changes together', () => {
  withDatabase(({ path }) => {
    const state = new SqliteMailState({ path });
    const account = state.createProviderAccount({ userId: 'user-a', provider: 'gmail' });

    assert.throws(() => state.transaction((tx) => {
      tx.beginIdempotentOperation({
        userId: 'user-a', accountId: account.id, operation: 'sync', key: 'sync-1', fingerprint: 'f1',
      });
      tx.putCursor({
        userId: 'user-a', accountId: account.id, provider: 'gmail', cursorType: 'history-id', cursorValue: '200',
      });
      throw new Error('simulate provider normalization failure');
    }), /simulate provider normalization failure/);

    assert.throws(
      () => state.getCursor({ userId: 'user-a', accountId: account.id, cursorType: 'history-id' }),
      SyncStateNotFoundError,
    );
    assert.throws(
      () => state.getIdempotentOperation({ userId: 'user-a', accountId: account.id, operation: 'sync', key: 'sync-1' }),
      /Idempotency record was not found/,
    );
    state.close();
  });
});
