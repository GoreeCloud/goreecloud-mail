import test from 'node:test';
import assert from 'node:assert/strict';

import { InMemoryProviderAccountRegistry } from '../server/provider-account-registry.js';
import { ProviderAccountService } from '../server/provider-account-service.js';
import { ProviderOperationService } from '../server/provider-operation-service.js';

test('provider operation dispatcher selects service from the owned account provider', async () => {
  const registry = new InMemoryProviderAccountRegistry();
  const accountService = new ProviderAccountService({ registry });
  const calls = [];
  const service = new ProviderOperationService({
    accountService,
    providerServices: {
      gmail: {
        async send(input) {
          calls.push(input);
          return { id: 'sent-1' };
        },
      },
    },
  });
  const account = accountService.create({ session: { userId: 'user-a' }, provider: 'gmail' });

  const result = await service.send({
    session: { userId: 'user-a' },
    accountId: account.id,
    message: { to: 'a@example.test', body: 'Hello' },
  });

  assert.deepEqual(result, { id: 'sent-1' });
  assert.equal(calls[0].accountId, account.id);
  assert.equal(calls[0].message.body, 'Hello');
});

test('cross-user provider operation dispatch fails before provider service invocation', async () => {
  const registry = new InMemoryProviderAccountRegistry();
  const accountService = new ProviderAccountService({ registry });
  let calls = 0;
  const service = new ProviderOperationService({
    accountService,
    providerServices: {
      gmail: {
        async send() {
          calls += 1;
          return {};
        },
      },
    },
  });
  const account = accountService.create({ session: { userId: 'user-a' }, provider: 'gmail' });

  await assert.rejects(
    service.send({ session: { userId: 'user-b' }, accountId: account.id, message: {} }),
    (error) => error.code === 'provider-account-not-found' && error.status === 404,
  );
  assert.equal(calls, 0);
});

test('providers without a registered write service fail closed', async () => {
  const registry = new InMemoryProviderAccountRegistry();
  const accountService = new ProviderAccountService({ registry });
  const service = new ProviderOperationService({ accountService });
  const account = accountService.create({ session: { userId: 'user-a' }, provider: 'imap-smtp' });

  await assert.rejects(
    service.createDraft({ session: { userId: 'user-a' }, accountId: account.id, message: {} }),
    (error) => error.code === 'unsupported-operation' && error.status === 400,
  );
});
