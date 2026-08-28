import test from 'node:test';
import assert from 'node:assert/strict';

import { InMemorySyncStateStore, SyncStateNotFoundError } from '../server/sync-state-store.js';

test('cursor state is scoped by user, account, and cursor type', () => {
  const store = new InMemorySyncStateStore();
  store.putCursor({ userId: 'user-a', accountId: 'account-a', provider: 'gmail', cursorType: 'history-id', cursorValue: '123' });
  assert.equal(store.getCursor({ userId: 'user-a', accountId: 'account-a', cursorType: 'history-id' }).cursorValue, '123');
  assert.throws(() => store.getCursor({ userId: 'user-b', accountId: 'account-a', cursorType: 'history-id' }), SyncStateNotFoundError);
});

test('public sync cursor records omit owning user identity', () => {
  const store = new InMemorySyncStateStore();
  const record = store.putCursor({ userId: 'user-a', accountId: 'account-a', provider: 'gmail', cursorType: 'history-id', cursorValue: '123' });
  assert.equal('userId' in record, false);
});

test('mailbox attempts preserve the last successful synchronization time', () => {
  const store = new InMemorySyncStateStore();
  store.recordMailboxSuccess({ userId: 'user-a', accountId: 'account-a', mailboxId: 'INBOX', syncedAt: '2026-08-21T08:00:00.000Z' });
  const state = store.recordMailboxAttempt({
    userId: 'user-a',
    accountId: 'account-a',
    mailboxId: 'INBOX',
    errorCode: 'temporary-provider-failure',
    attemptedAt: '2026-08-21T08:05:00.000Z',
  });
  assert.equal(state.lastSuccessfulSyncAt, '2026-08-21T08:00:00.000Z');
  assert.equal(state.lastAttemptedSyncAt, '2026-08-21T08:05:00.000Z');
  assert.equal(state.lastErrorCode, 'temporary-provider-failure');
});

test('successful synchronization clears prior mailbox error state', () => {
  const store = new InMemorySyncStateStore();
  store.recordMailboxAttempt({ userId: 'user-a', accountId: 'account-a', mailboxId: 'INBOX', errorCode: 'temporary-provider-failure' });
  const state = store.recordMailboxSuccess({ userId: 'user-a', accountId: 'account-a', mailboxId: 'INBOX', syncedAt: '2026-08-21T08:10:00.000Z' });
  assert.equal(state.lastErrorCode, null);
  assert.equal(state.lastSuccessfulSyncAt, '2026-08-21T08:10:00.000Z');
});
