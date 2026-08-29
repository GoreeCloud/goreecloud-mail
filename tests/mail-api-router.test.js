import test from 'node:test';
import assert from 'node:assert/strict';

import { routeMailApi } from '../server/mail-api-router.js';
import { ProviderAccountService } from '../server/provider-account-service.js';
import { InMemoryProviderAccountRegistry } from '../server/provider-account-registry.js';

function fixture({ capabilityResolver } = {}) {
  const registry = new InMemoryProviderAccountRegistry();
  return {
    registry,
    accountService: new ProviderAccountService({
      registry,
      ...(capabilityResolver ? { capabilityResolver } : {}),
    }),
  };
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

test('provider capabilities are resolved from the trusted account instead of caller-supplied provider state', async () => {
  const resolverCalls = [];
  const { accountService } = fixture({
    capabilityResolver: async ({ userId, account }) => {
      resolverCalls.push({ userId, account });
      return account.externalAccountId === 'work@example.test'
        ? { send: true, labels: true, organizationPolicies: true, unknownFlag: true }
        : { send: true, labels: false };
    },
  });

  const work = accountService.create({
    session: { userId: 'alice' },
    provider: 'gmail',
    externalAccountId: 'work@example.test',
  });
  const personal = accountService.create({
    session: { userId: 'alice' },
    provider: 'gmail',
    externalAccountId: 'personal@example.test',
  });

  const workResult = await routeMailApi({
    method: 'GET',
    pathname: `/api/mail/accounts/${work.id}/capabilities`,
    session: { userId: 'alice' },
    accountService,
  });
  const personalResult = await routeMailApi({
    method: 'GET',
    pathname: `/api/mail/accounts/${personal.id}/capabilities`,
    session: { userId: 'alice' },
    accountService,
  });

  assert.equal(workResult.status, 200);
  assert.equal(workResult.body.accountId, work.id);
  assert.equal(workResult.body.provider, 'gmail');
  assert.equal(workResult.body.capabilities.send, true);
  assert.equal(workResult.body.capabilities.labels, true);
  assert.equal(workResult.body.capabilities.organizationPolicies, true);
  assert.equal(Object.hasOwn(workResult.body.capabilities, 'unknownFlag'), false);
  assert.equal('userId' in workResult.body, false);

  assert.equal(personalResult.body.capabilities.send, true);
  assert.equal(personalResult.body.capabilities.labels, false);
  assert.equal(personalResult.body.capabilities.organizationPolicies, false);

  assert.equal(resolverCalls.length, 2);
  assert.equal(resolverCalls[0].userId, 'alice');
  assert.equal('userId' in resolverCalls[0].account, false);
});

test('cross-user capability lookup fails before the capability resolver runs', async () => {
  let resolverCalls = 0;
  const { accountService } = fixture({
    capabilityResolver: async () => {
      resolverCalls += 1;
      return { send: true };
    },
  });
  const created = accountService.create({ session: { userId: 'alice' }, provider: 'gmail' });

  const result = await routeMailApi({
    method: 'GET',
    pathname: `/api/mail/accounts/${created.id}/capabilities`,
    session: { userId: 'bob' },
    accountService,
  });

  assert.equal(result.status, 404);
  assert.equal(result.body.error.code, 'provider-account-not-found');
  assert.equal(resolverCalls, 0);
});

test('capability discovery defaults fail closed when no resolver is configured', async () => {
  const { accountService } = fixture();
  const created = accountService.create({ session: { userId: 'alice' }, provider: 'imap-smtp' });

  const result = await routeMailApi({
    method: 'GET',
    pathname: `/api/mail/accounts/${created.id}/capabilities`,
    session: { userId: 'alice' },
    accountService,
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.capabilities.send, false);
  assert.equal(result.body.capabilities.folders, false);
  assert.equal(result.body.capabilities.customDomains, false);
});

test('unknown mail API routes return bounded 404 responses', async () => {
  const { accountService } = fixture();
  const result = await routeMailApi({ method: 'GET', pathname: '/api/mail/unknown', session: { userId: 'alice' }, accountService });
  assert.deepEqual(result, {
    status: 404,
    body: { error: { code: 'route-not-found', message: 'Mail API route was not found.', retryable: false } },
  });
});
