import test from 'node:test';
import assert from 'node:assert/strict';

import { GmailAccountService } from '../server/gmail-account-service.js';
import { decodeGmailRawMessage } from '../server/gmail-message-builder.js';
import { InMemoryProviderAccountRegistry } from '../server/provider-account-registry.js';
import { ProviderAccountService } from '../server/provider-account-service.js';
import { ProviderError, PROVIDER_ERROR_CODES } from '../web/providers/provider-error.js';

function createFixture(client) {
  const registry = new InMemoryProviderAccountRegistry();
  const accountService = new ProviderAccountService({
    registry,
    capabilityResolver: async () => ({ drafts: true }),
  });
  const session = { userId: 'user-a' };
  const account = accountService.create({ session, provider: 'gmail' });
  const gmail = new GmailAccountService({
    accountService,
    gmailClientFactory: () => client,
  });
  return { gmail, session, account };
}

function message(clientMutationId) {
  return {
    clientMutationId,
    to: 'recipient@example.test',
    subject: 'Draft',
    body: 'Body',
  };
}

function temporaryFailure() {
  return new ProviderError('temporary', {
    code: PROVIDER_ERROR_CODES.TEMPORARY,
    status: 503,
    retryable: true,
  });
}

test('ambiguous Gmail draft create is reconciled without replaying the write', async () => {
  let createCalls = 0;
  let lookupCalls = 0;
  let observedMessageId = null;
  const client = {
    async createDraft(_context, { raw }) {
      createCalls += 1;
      const decoded = decodeGmailRawMessage(raw);
      observedMessageId = decoded.match(/^Message-ID: (.+)$/m)?.[1]?.trim() || null;
      throw temporaryFailure();
    },
    async findDraftByRfcMessageId(_context, { messageId }) {
      lookupCalls += 1;
      assert.equal(messageId, observedMessageId);
      return [{ id: 'draft-1', message: { id: 'message-1', threadId: 'thread-1' } }];
    },
  };
  const { gmail, session, account } = createFixture(client);

  const result = await gmail.createDraft({
    session,
    accountId: account.id,
    message: message('draft-create-001'),
  });

  assert.equal(createCalls, 1);
  assert.equal(lookupCalls, 1);
  assert.deepEqual(result, {
    id: 'draft-1',
    message: { id: 'message-1', threadId: 'thread-1', labelIds: [] },
    reconciled: true,
  });
});

test('ambiguous Gmail draft update reconciles only to the exact draft being replaced', async () => {
  let updateCalls = 0;
  const client = {
    async updateDraft(_context, { draftId, raw }) {
      updateCalls += 1;
      assert.equal(draftId, 'draft-1');
      const decoded = decodeGmailRawMessage(raw);
      assert.match(decoded, /^Message-ID: <goreecloud-[a-f0-9]{64}@mail\.goreecloud\.invalid>$/m);
      throw temporaryFailure();
    },
    async findDraftByRfcMessageId() {
      return [{ id: 'draft-1', message: { id: 'message-2', threadId: 'thread-1' } }];
    },
  };
  const { gmail, session, account } = createFixture(client);

  const result = await gmail.updateDraft({
    session,
    accountId: account.id,
    draftId: 'draft-1',
    message: message('draft-update-001'),
  });

  assert.equal(updateCalls, 1);
  assert.deepEqual(result, {
    id: 'draft-1',
    message: { id: 'message-2', threadId: 'thread-1', labelIds: [] },
    reconciled: true,
  });
});

test('ambiguous draft update fails closed when reconciliation resolves to another draft', async () => {
  let updateCalls = 0;
  const client = {
    async updateDraft() {
      updateCalls += 1;
      throw temporaryFailure();
    },
    async findDraftByRfcMessageId() {
      return [{ id: 'draft-other', message: { id: 'message-3', threadId: null } }];
    },
  };
  const { gmail, session, account } = createFixture(client);

  await assert.rejects(
    gmail.updateDraft({
      session,
      accountId: account.id,
      draftId: 'draft-1',
      message: message('draft-update-002'),
    }),
    (error) =>
      error.code === PROVIDER_ERROR_CODES.WRITE_OUTCOME_UNKNOWN &&
      error.retryable === false &&
      error.status === 502,
  );
  assert.equal(updateCalls, 1);
});

test('ambiguous draft create with no confirmed match is non-retryable outcome unknown', async () => {
  let createCalls = 0;
  const client = {
    async createDraft() {
      createCalls += 1;
      throw temporaryFailure();
    },
    async findDraftByRfcMessageId() {
      return [];
    },
  };
  const { gmail, session, account } = createFixture(client);

  await assert.rejects(
    gmail.createDraft({
      session,
      accountId: account.id,
      message: message('draft-create-002'),
    }),
    (error) =>
      error.code === PROVIDER_ERROR_CODES.WRITE_OUTCOME_UNKNOWN &&
      error.retryable === false &&
      error.status === 502,
  );
  assert.equal(createCalls, 1);
});
