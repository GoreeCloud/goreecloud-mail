import test from 'node:test';
import assert from 'node:assert/strict';

import { routeMailApi } from '../server/mail-api-router.js';
import { ProviderAccountService } from '../server/provider-account-service.js';
import { InMemoryProviderAccountRegistry } from '../server/provider-account-registry.js';

function fixture() {
  const registry = new InMemoryProviderAccountRegistry();
  return { registry, accountService: new ProviderAccountService({ registry }) };
}

test('mail account routes require trusted session identity', async () => {
  const { accountService } = fixture();
  const result = await routeMailApi({ method: 'GET', pathname: '/api/mail/accounts', session: {}, accountService });
  assert.equal(result.status, 401);
  assert.equal(result.body.error.code, 'authentication-required');
});

test('account create and list are scoped to authenticated user', async () => {
  const { accountService } = fixture();
  const created = await routeMailApi({
    method: 'POST',
    pathname: '/api/mail/accounts',
    session: { userId: 'alice' },
    body: { provider: 'gmail', externalAccountId: 'alice@example.test', displayName: 'Alice' },
    accountService,
  });
  assert.equal(created.status, 201);

  const alice = await routeMailApi({ method: 'GET', pathname: '/api/mail/accounts', session: { userId: 'alice' }, accountService });
  const bob = await routeMailApi({ method: 'GET', pathname: '/api/mail/accounts', session: { userId: 'bob' }, accountService });
  assert.equal(alice.body.accounts.length, 1);
  assert.equal(bob.body.accounts.length, 0);
  assert.equal('userId' in alice.body.accounts[0], false);
});

test('cross-user account lookup fails closed', async () => {
  const { accountService } = fixture();
  const created = accountService.create({ session: { userId: 'alice' }, provider: 'gmail' });
  const result = await routeMailApi({
    method: 'GET',
    pathname: `/api/mail/accounts/${created.id}`,
    session: { userId: 'bob' },
    accountService,
  });
  assert.equal(result.status, 404);
  assert.equal(result.body.error.code, 'provider-account-not-found');
});

test('unknown mail API routes return bounded 404 responses', async () => {
  const { accountService } = fixture();
  const result = await routeMailApi({ method: 'GET', pathname: '/api/mail/unknown', session: { userId: 'alice' }, accountService });
  assert.deepEqual(result, {
    status: 404,
    body: { error: { code: 'route-not-found', message: 'Mail API route was not found.', retryable: false } },
  });
});
