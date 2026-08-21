import test from 'node:test';
import assert from 'node:assert/strict';

import { InMemoryIdempotencyStore, IdempotencyConflictError } from '../server/idempotency-store.js';

const scope = { userId: 'user-a', accountId: 'account-a', operation: 'sync-mailbox', key: 'run-1' };

test('reuses the same idempotency record for matching fingerprints', () => {
  const store = new InMemoryIdempotencyStore();
  const first = store.begin({ ...scope, fingerprint: 'fingerprint-a' });
  const second = store.begin({ ...scope, fingerprint: 'fingerprint-a' });
  assert.equal(first.status, 'in-progress');
  assert.deepEqual(second, first);
});

test('rejects reuse of a key with incompatible input', () => {
  const store = new InMemoryIdempotencyStore();
  store.begin({ ...scope, fingerprint: 'fingerprint-a' });
  assert.throws(() => store.begin({ ...scope, fingerprint: 'fingerprint-b' }), IdempotencyConflictError);
});

test('completed results are isolated and user scoped', () => {
  const store = new InMemoryIdempotencyStore();
  store.begin({ ...scope, fingerprint: 'fingerprint-a' });
  const result = { cursor: 'cursor-2' };
  const completed = store.complete({ ...scope, result });
  result.cursor = 'mutated';
  assert.equal(completed.result.cursor, 'cursor-2');
  assert.throws(() => store.get({ ...scope, userId: 'user-b' }));
});

test('failed operations preserve a bounded error code', () => {
  const store = new InMemoryIdempotencyStore();
  store.begin({ ...scope, fingerprint: 'fingerprint-a' });
  const failed = store.fail({ ...scope, errorCode: 'temporary-provider-failure' });
  assert.equal(failed.status, 'failed');
  assert.equal(failed.errorCode, 'temporary-provider-failure');
  assert.equal(failed.result, null);
});
