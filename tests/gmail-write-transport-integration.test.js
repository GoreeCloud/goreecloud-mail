import test from 'node:test';
import assert from 'node:assert/strict';

import { InMemoryCredentialVault } from '../server/credential-vault.js';
import { GmailAccountService } from '../server/gmail-account-service.js';
import { GMAIL_OAUTH_SCOPE } from '../server/gmail-capability-resolver.js';
import { decodeGmailRawMessage } from '../server/gmail-message-builder.js';
import { routeMailApi } from '../server/mail-api-router.js';
import { InMemoryProviderAccountRegistry } from '../server/provider-account-registry.js';
import { ProviderAccountService } from '../server/provider-account-service.js';
import { createProviderCapabilityResolver } from '../server/provider-capability-resolver.js';
import { ProviderOperationService } from '../server/provider-operation-service.js';
import { GmailMailProvider } from '../web/providers/gmail-provider.js';
import { ProviderGateway } from '../web/providers/provider-gateway.js';

function webResponse(result) {
  return new Response(JSON.stringify(structuredClone(result.body)), {
    status: result.status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function buildHarness({ scope, sessionUser = 'user-a' }) {
  const registry = new InMemoryProviderAccountRegistry();
  const credentialVault = new InMemoryCredentialVault();
  const accountService = new ProviderAccountService({
    registry,
    capabilityResolver: createProviderCapabilityResolver({ credentialVault }),
  });
  const account = accountService.create({ session: { userId: 'user-a' }, provider: 'gmail' });
  credentialVault.put({
    userId: 'user-a',
    accountId: account.id,
    provider: 'gmail',
    secret: { scope },
  });

  const calls = [];
  const gmailAccountService = new GmailAccountService({
    accountService,
    gmailClientFactory: () => ({
      async sendMessage(_context, { raw }) {
        calls.push({ operation: 'send', raw });
        return { id: 'sent-1', threadId: 'thread-1', labelIds: ['SENT'] };
      },
      async createDraft(_context, { raw }) {
        calls.push({ operation: 'createDraft', raw });
        return { id: 'draft-1', message: { id: 'message-1', threadId: 'thread-1', labelIds: ['DRAFT'] } };
      },
      async updateDraft(_context, { draftId, raw }) {
        calls.push({ operation: 'updateDraft', draftId, raw });
        return { id: draftId, message: { id: 'message-2', threadId: 'thread-1', labelIds: ['DRAFT'] } };
      },
    }),
  });
  const operationService = new ProviderOperationService({
    accountService,
    providerServices: { gmail: gmailAccountService },
  });
  const gateway = new ProviderGateway({
    baseUrl: '/api/mail',
    fetchImpl: async (url, options) => {
      const parsed = new URL(url, 'https://mail.goreecloud.test');
      const body = options.body ? JSON.parse(options.body) : null;
      return webResponse(await routeMailApi({
        method: options.method,
        pathname: parsed.pathname,
        session: { userId: sessionUser },
        body,
        accountService,
        operationService,
      }));
    },
  });

  return {
    account,
    calls,
    provider: new GmailMailProvider({ accountId: account.id, gateway }),
  };
}

test('gmail.compose carries browser send and draft operations through trusted account routing', async () => {
  const { provider, calls } = buildHarness({ scope: GMAIL_OAUTH_SCOPE.COMPOSE });

  const sent = await provider.send({
    to: 'recipient@example.test',
    subject: 'Hello',
    body: 'Send body',
  });
  const created = await provider.createDraft({
    to: 'recipient@example.test',
    subject: 'Draft',
    body: 'Draft body',
  });
  const updated = await provider.updateDraft('draft/1', {
    to: 'recipient@example.test',
    subject: 'Updated',
    body: 'Updated body',
  });

  assert.equal(sent.id, 'sent-1');
  assert.equal(created.id, 'draft-1');
  assert.equal(updated.id, 'draft/1');
  assert.deepEqual(calls.map((call) => call.operation), ['send', 'createDraft', 'updateDraft']);
  assert.match(decodeGmailRawMessage(calls[0].raw), /Subject: Hello\r\n/);
  assert.match(decodeGmailRawMessage(calls[1].raw), /\r\n\r\nDraft body$/);
  assert.equal(calls[2].draftId, 'draft/1');
});

test('gmail.send permits send but rejects draft creation before Gmail transport', async () => {
  const { provider, calls } = buildHarness({ scope: GMAIL_OAUTH_SCOPE.SEND });

  await provider.send({ to: 'recipient@example.test', subject: 'Allowed', body: 'Body' });
  assert.deepEqual(calls.map((call) => call.operation), ['send']);

  await assert.rejects(
    provider.createDraft({ to: 'recipient@example.test', subject: 'Blocked', body: 'Body' }),
    (error) => error.code === 'provider-capability-unavailable' && error.status === 400,
  );
  assert.deepEqual(calls.map((call) => call.operation), ['send']);
});

test('browser knowledge of another users account id cannot execute a Gmail send', async () => {
  const { provider, calls } = buildHarness({
    scope: GMAIL_OAUTH_SCOPE.COMPOSE,
    sessionUser: 'user-b',
  });

  await assert.rejects(
    provider.send({ to: 'recipient@example.test', subject: 'Blocked', body: 'Body' }),
    (error) => error.code === 'provider-account-not-found' && error.status === 404,
  );
  assert.equal(calls.length, 0);
});