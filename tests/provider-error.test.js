import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PROVIDER_ERROR_CODES,
  ProviderError,
  normalizeProviderError,
  publicProviderError,
} from '../web/providers/provider-error.js';

test('provider errors preserve already-normalized errors', () => {
  const error = new ProviderError('Retry later.', {
    code: PROVIDER_ERROR_CODES.TEMPORARY,
    status: 503,
    retryable: true,
  });
  assert.equal(normalizeProviderError(error), error);
});

test('provider HTTP failures become bounded client-safe errors', () => {
  const error = normalizeProviderError({ status: 429, message: 'secret provider response' });
  assert.equal(error.code, PROVIDER_ERROR_CODES.RATE_LIMITED);
  assert.equal(error.status, 429);
  assert.equal(error.retryable, true);
  assert.doesNotMatch(error.message, /secret provider response/);
});

test('public provider errors expose only the normalized contract', () => {
  const body = publicProviderError({ response: { status: 401 }, token: 'do-not-leak' });
  assert.deepEqual(body, {
    error: {
      code: PROVIDER_ERROR_CODES.AUTH_REQUIRED,
      message: 'Provider authorization is required.',
      retryable: false,
    },
  });
  assert.doesNotMatch(JSON.stringify(body), /do-not-leak/);
});
