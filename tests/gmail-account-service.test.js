import test from 'node:test';
import assert from 'node:assert/strict';

import { InMemoryProviderAccountRegistry } from '../server/provider-account-registry.js';
import { ProviderAccountService } from '../server/provider-account-service.js';
import { GmailAccountService } from '../server/gmail-account-service.js';

function build() {
  const registry = new InMemoryProviderAccountRegistry();
  const accountService = new ProviderAccountService({ registry });
  const calls = [];
  const gmail = new GmailAccountService({
    accountService,
    gmailClientFactory: (context) => ({
      listLabels: async (received) => { calls.push(['labels', received]); return []; },
      listMessages: async (received, options) => { calls.push(['messages', received, options]); return { messageRefs: [] }; },
      getMessage: async (received, messageId) => { calls.push(['message', received, messageId]); return { id: messageId }; },
      getAttachment: async (received, options) => { calls.push(['attachment', received, options]); return { attachmentId: options.attachmentId, bytes: Buffer.alloc(0), size: 0 }; },
    }),
  });
  return { accountService, gmail, calls };
}

test('Gmail operations derive user ownership from trusted session state', async () => {
  const { accountService, gmail, calls } = build();
  const account = accountService.create({ session: { userId: 'user-a' }, provider: 'gmail' });
  await gmail.listLabels({ session: { userId: 'user-a' }, accountId: account.id });
  assert.equal(calls[0][1].userId, 'user-a');
  assert.equal(calls[0][1].accountId, account.id);
});

test('Gmail attachment operations preserve account ownership and provider identifiers', async () => {
  const { accountService, gmail, calls } = build();
  const account = accountService.create({ session: { userId: 'user-a' }, provider: 'gmail' });
  await gmail.getAttachment({
    session: { userId: 'user-a' },
    accountId: account.id,
    messageId: 'm1',
    attachmentId: 'att1',
    maxBytes: 1024,
  });
  assert.equal(calls[0][0], 'attachment');
  assert.equal(calls[0][1].userId, 'user-a');
  assert.equal(calls[0][1].accountId, account.id);
  assert.deepEqual(calls[0][2], { messageId: 'm1', attachmentId: 'att1', maxBytes: 1024 });
});

test('cross-user Gmail transport access fails before client creation/use', async () => {
  const { accountService, gmail, calls } = build();
  const account = accountService.create({ session: { userId: 'user-a' }, provider: 'gmail' });
  await assert.rejects(
    gmail.listMessages({ session: { userId: 'user-b' }, accountId: account.id }),
    (error) => error.code === 'provider-account-not-found' && error.status === 404,
  );
  assert.equal(calls.length, 0);
});

test('cross-user Gmail attachment access fails before provider retrieval', async () => {
  const { accountService, gmail, calls } = build();
  const account = accountService.create({ session: { userId: 'user-a' }, provider: 'gmail' });
  await assert.rejects(
    gmail.getAttachment({ session: { userId: 'user-b' }, accountId: account.id, messageId: 'm1', attachmentId: 'att1' }),
    (error) => error.code === 'provider-account-not-found' && error.status === 404,
  );
  assert.equal(calls.length, 0);
});

test('non-Gmail accounts cannot cross into Gmail transport', async () => {
  const { accountService, gmail, calls } = build();
  const account = accountService.create({ session: { userId: 'user-a' }, provider: 'imap-smtp' });
  await assert.rejects(
    gmail.listLabels({ session: { userId: 'user-a' }, accountId: account.id }),
    (error) => error.code === 'unsupported-operation' && error.status === 400,
  );
  assert.equal(calls.length, 0);
});
