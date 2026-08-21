import test from 'node:test';
import assert from 'node:assert/strict';

import { runProviderRequest } from '../server/provider-request-policy.js';

test('retries retryable provider failures with bounded exponential delay', async () => {
  let attempts = 0;
  const delays = [];
  const result = await runProviderRequest(async () => {
    attempts += 1;
    if (attempts < 3) {
      const error = new Error('temporary');
      error.status = 503;
      throw error;
    }
    return 'ok';
  }, {
    maxAttempts: 3,
    baseDelayMs: 10,
    maxDelayMs: 15,
    timeoutMs: 1000,
    sleep: async (ms) => delays.push(ms),
  });

  assert.equal(result, 'ok');
  assert.equal(attempts, 3);
  assert.deepEqual(delays, [10, 15]);
});

test('does not retry authentication failures', async () => {
  let attempts = 0;
  await assert.rejects(runProviderRequest(async () => {
    attempts += 1;
    const error = new Error('unauthorized');
    error.status = 401;
    throw error;
  }, { sleep: async () => {} }), (error) => error.status === 401);
  assert.equal(attempts, 1);
});

test('honors a bounded Retry-After hint', async () => {
  let attempts = 0;
  const delays = [];
  await assert.rejects(runProviderRequest(async () => {
    attempts += 1;
    const error = new Error('rate limited');
    error.status = 429;
    error.retryAfterMs = 5000;
    throw error;
  }, {
    maxAttempts: 2,
    maxDelayMs: 100,
    timeoutMs: 1000,
    sleep: async (ms) => delays.push(ms),
  }));
  assert.equal(attempts, 2);
  assert.deepEqual(delays, [100]);
});

test('aborted provider work becomes a retryable bounded temporary failure', async () => {
  let attempts = 0;
  await assert.rejects(runProviderRequest(async ({ signal }) => {
    attempts += 1;
    await new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      }, { once: true });
    });
  }, {
    maxAttempts: 1,
    timeoutMs: 5,
  }), (error) => error.code === 'temporary-provider-failure' && error.retryable === true);
  assert.equal(attempts, 1);
});
