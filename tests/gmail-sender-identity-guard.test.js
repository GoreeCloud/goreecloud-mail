import test from 'node:test';
import assert from 'node:assert/strict';

import { GmailAccountService } from '../server/gmail-account-service.js';
import { InMemoryProviderAccountRegistry } from '../server/provider-account-registry.js';
import { ProviderAccountService } from '../server/provider-account-service.js';

test('caller-supplied From requires explicit sender-identity capability before Gmail transport', async () => {
  const registry = new InMemoryProviderAccountRegistry();
  const accountService = new ProviderAccountService({
    registry,
    capabilityResolver: async () => ({ send: true, senderIdentities: false }),
  });
  let clientCalls = 0;
  const gmail = new GmailAccountService({
    accountService,
    gmailClientFactory: () => {
      clientCalls += 1;
      return { sendMessage: async () => ({ id: 'sent' }) };
    },
  });
  const account = accountService.create({ session: { userId: 'user-a' }, provider: 'gmail' });

  await assert.rejects(
    gmail.send({
      session: { userId: 'user-a' },
      accountId: account.id,
      message: {
        from: 'alias@example.test',
        to: 'recipient@example.test',
        subject: 'Alias attempt',
        body: 'Body',
      },
    }),
    (error) =>
      error.code === 'provider-capability-unavailable' &&
      error.capability === 'senderIdentities' &&
      error.status === 400,
  );
  assert.equal(clientCalls, 0);
});
