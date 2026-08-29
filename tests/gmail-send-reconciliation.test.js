import test from 'node:test';
import assert from 'node:assert/strict';

import { GmailAccountService, deriveReconciliationMessageId } from '../server/gmail-account-service.js';
import { decodeGmailRawMessage } from '../server/gmail-message-builder.js';
import { InMemoryProviderAccountRegistry } from '../server/provider-account-registry.js';
import { ProviderAccountService } from '../server/provider-account-service.js';
import { ProviderError, PROVIDER_ERROR_CODES } from '../web/providers/provider-error.js';

function createFixture(client) {
  const registry = new InMemoryProviderAccountRegistry();
  const accountService = new ProviderAccountService({
    registry,
    capabilityResolver: async () => ({ send: true }),
  });
  const session = { userId: 'user-a' };
  const account = accountService.create({ session, provider: 'gmail' });
  const gmail = new GmailAccountService({
    accountService,
    gmailClientFactory: () => client,
  });
  return { gmail, session, account };
}

function message(clientMutationId = 'send-001') {
  return {
    clientMutationId,
    to: 'recipient@example.test',
    subject: 'Hello',
    body: 'Body',
  };
}

test('reconciliation Message-ID is deterministic, bounded, and account scoped', () => {
  const first = deriveReconciliationMessageId({ accountId: 'account-a', clientMutationId: 'mutation-1' });
  const second = deriveReconciliationMessageId({ accountId: 'account-a', clientMutationId: 'mutation-1' });
  const otherAccount = deriveReconciliationMessageId({ accountId: 'account-b', clientMutationId: 'mutation-1' });

  assert.equal(first, second);
  assert.notEqual(first, otherAccount);
  assert.match(first, /^<goreecloud-[a-f0-9]{64}@mail\.goreecloud\.invalid>$/);
  assert.doesNotMatch(first, /mutation-1|account-a/);
});

test('ambiguous Gmail send is reconciled by exact Message-ID without replaying the write', async () => {
  let sendCalls = 0;
  let lookupCalls = 0;
  let observedMessageId = null;
  const client = {
    async sendMessage(_context, { raw }) {
      sendCalls += 1;
      const decoded = decodeGmailRawMessage(raw);
      observedMessageId = decoded.match(/^Message-ID: (.+)$/m)?.[1]?.trim() || null;
      throw new ProviderError('temporary', {
        code: PROVIDER_ERROR_CODES.TEMPORARY,
        status: 503,
        retryable: true,
      });
    },
    async findSentMessageByRfcMessageId(_context, { messageId }) {
      lookupCalls += 1;
      assert.equal(messageId, observedMessageId);
      return [{ id: 'sent-1', threadId: 'thread-1' }];
    },
  };
  const { gmail, session, account } = createFixture(client);

  const result = await gmail.send({
    session,
    accountId: account.id,
    message: message(),
  });

  assert.equal(sendCalls, 1);
  assert.equal(lookupCalls, 1);
  assert.deepEqual(result, {
    id: 'sent-1',
    threadId: 'thread-1',
    labelIds: ['SENT'],
    reconciled: true,
  });
});

test('unconfirmed ambiguous Gmail send fails closed with non-retryable outcome-unknown state', async () => {
  let sendCalls = 0;
  const client = {
    async sendMessage() {
      sendCalls += 1;
      throw new ProviderError('temporary', {
        code: PROVIDER_ERROR_CODES.TEMPORARY,
        status: 503,
        retryable: true,
      });
    },
    async findSentMessageByRfcMessageId() {
      return [];
    },
  };
  const { gmail, session, account } = createFixture(client);

  await assert.rejects(
    gmail.send({ session, accountId: account.id, message: message('send-002') }),
    (error) =>
      error.code === PROVIDER_ERROR_CODES.WRITE_OUTCOME_UNKNOWN &&
      error.retryable === false &&
      error.status === 502,
  );
  assert.equal(sendCalls, 1);
});

test('deterministic provider rejection does not invoke reconciliation lookup', async () => {
  let lookupCalls = 0;
  const client = {
    async sendMessage() {
      throw new ProviderError('forbidden', {
        code: PROVIDER_ERROR_CODES.FORBIDDEN,
        status: 403,
      });
    },
    async findSentMessageByRfcMessageId() {
      lookupCalls += 1;
      return [];
    },
  };
  const { gmail, session, account } = createFixture(client);

  await assert.rejects(
    gmail.send({ session, accountId: account.id, message: message('send-003') }),
    (error) => error.code === PROVIDER_ERROR_CODES.FORBIDDEN,
  );
  assert.equal(lookupCalls, 0);
});
