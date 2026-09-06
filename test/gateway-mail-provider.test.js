import test from 'node:test';
import assert from 'node:assert/strict';

import { GatewayMailProvider } from '../web/providers/gateway-mail-provider.js';
import { ProviderGateway } from '../web/providers/provider-gateway.js';
import { GmailMailProvider } from '../web/providers/gmail-provider.js';
import { ImapSmtpMailProvider } from '../web/providers/imap-smtp-provider.js';

function response(body, { status = 200 } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  };
}

test('ProviderGateway uses same-origin credentials and JSON bodies', async () => {
  const calls = [];
  const gateway = new ProviderGateway({
    baseUrl: '/api/mail/',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return response({ ok: true });
    },
  });

  await gateway.request('/accounts/account-1/messages', {
    method: 'POST',
    body: { subject: 'Hello' },
  });

  assert.equal(calls[0].url, '/api/mail/accounts/account-1/messages');
  assert.equal(calls[0].options.credentials, 'same-origin');
  assert.equal(calls[0].options.headers['content-type'], 'application/json');
  assert.equal(calls[0].options.body, JSON.stringify({ subject: 'Hello' }));
});

test('ProviderGateway preserves bounded trusted-backend provider errors', async () => {
  const gateway = new ProviderGateway({
    fetchImpl: async () =>
      response(
        {
          error: {
            code: 'provider-capability-unavailable',
            message: 'This account cannot perform that provider operation.',
            retryable: false,
          },
        },
        { status: 400 },
      ),
  });

  await assert.rejects(
    gateway.request('/accounts/account-1/messages'),
    (error) =>
      error.code === 'provider-capability-unavailable' &&
      error.status === 400 &&
      error.retryable === false &&
      error.message === 'This account cannot perform that provider operation.',
  );
});

test('ProviderGateway preserves the bounded account-isolation not-found contract', async () => {
  const gateway = new ProviderGateway({
    fetchImpl: async () =>
      response(
        {
          error: {
            code: 'provider-account-not-found',
            message: 'Provider account was not found.',
            retryable: false,
          },
        },
        { status: 404 },
      ),
  });

  await assert.rejects(
    gateway.request('/accounts/another-users-account/capabilities'),
    (error) =>
      error.code === 'provider-account-not-found' &&
      error.status === 404 &&
      error.retryable === false &&
      error.message === 'Provider account was not found.',
  );
});

test('ProviderGateway rejects malformed trusted-backend error fields before public projection', async () => {
  const invalidErrors = [
    {
      code: 'not-a-provider-error-code',
      message: 'Arbitrary backend error.',
      retryable: false,
    },
    {
      code: 'invalid-request',
      message: ' x'.repeat(600),
      retryable: false,
    },
    {
      code: 'invalid-request',
      message: 'Malformed\nbackend message',
      retryable: false,
    },
    {
      code: 'invalid-request',
      message: 'Looks false but is a string.',
      retryable: 'false',
    },
  ];

  for (const backendError of invalidErrors) {
    const gateway = new ProviderGateway({
      fetchImpl: async () => response({ error: backendError }, { status: 400 }),
    });

    await assert.rejects(
      gateway.request('/accounts/account-1/messages'),
      (error) =>
        error.code === 'invalid-request' &&
        error.status === 400 &&
        error.retryable === false &&
        error.message === 'The provider rejected the request.',
    );
  }
});

test('ProviderGateway normalizes unstructured HTTP failures instead of exposing arbitrary response content', async () => {
  const gateway = new ProviderGateway({
    fetchImpl: async () => ({
      ok: false,
      status: 503,
      async json() {
        throw new Error('invalid response');
      },
    }),
  });

  await assert.rejects(
    gateway.request('/accounts/account-1/messages'),
    (error) =>
      error.code === 'temporary-provider-failure' &&
      error.status === 503 &&
      error.retryable === true,
  );
});

test('GatewayMailProvider encodes account and message identifiers and unwraps account capability responses', async () => {
  const calls = [];
  const gateway = {
    async request(path, options) {
      calls.push({ path, options });
      if (path.endsWith('/capabilities')) {
        return {
          accountId: 'account/with spaces',
          provider: 'gmail',
          capabilities: { mailboxAccess: true, search: true, send: true },
        };
      }
      return { ok: true };
    },
  };

  const provider = new GatewayMailProvider({ accountId: 'account/with spaces', gateway });
  await provider.getMessage('message/with spaces');
  const capabilities = await provider.capabilities();

  assert.equal(
    calls[0].path,
    '/accounts/account%2Fwith%20spaces/messages/message%2Fwith%20spaces',
  );
  assert.equal(calls[1].path, '/accounts/account%2Fwith%20spaces/capabilities');
  assert.equal(capabilities.mailboxAccess, true);
  assert.equal(capabilities.search, true);
  assert.equal(capabilities.send, true);
  assert.equal(capabilities.archive, false);
  assert.equal(Object.hasOwn(capabilities, 'accountId'), false);
  assert.equal(Object.hasOwn(capabilities, 'provider'), false);
});

test('GatewayMailProvider bounds search input without normalizing ordinary query text', async () => {
  const calls = [];
  const provider = new GatewayMailProvider({
    accountId: 'account-1',
    gateway: {
      async request(path, options) {
        calls.push({ path, options });
        return { ok: true };
      },
    },
  });

  await provider.search('  subject:hello world  ');
  assert.equal(
    calls[0].path,
    '/accounts/account-1/search?q=%20%20subject%3Ahello%20world%20%20',
  );

  for (const invalid of [undefined, null, {}, '', '   ', 'subject:test\nfrom:other', 'x'.repeat(4097)]) {
    assert.throws(() => provider.search(invalid), TypeError);
  }
  assert.equal(calls.length, 1);
});

test('GatewayMailProvider requires an exact boolean flag state before mutation request', async () => {
  const calls = [];
  const provider = new GatewayMailProvider({
    accountId: 'account-1',
    gateway: {
      async request(path, options) {
        calls.push({ path, options });
        return { ok: true };
      },
    },
  });

  await provider.flag('message-1', false);
  assert.deepEqual(calls[0], {
    path: '/accounts/account-1/messages/message-1/flag',
    options: { method: 'PUT', body: { flagged: false } },
  });

  for (const invalid of [0, 1, 'false', null, {}]) {
    assert.throws(() => provider.flag('message-1', invalid), TypeError);
  }
  assert.equal(calls.length, 1);
});

test('GatewayMailProvider still normalizes a direct capability map from compatible gateway implementations', async () => {
  const provider = new GatewayMailProvider({
    accountId: 'account-1',
    gateway: { request: async () => ({ search: true, send: false }) },
  });
  const capabilities = await provider.capabilities();
  assert.equal(capabilities.search, true);
  assert.equal(capabilities.send, false);
  assert.equal(capabilities.mailboxAccess, false);
});

test('provider-specific gateway wrappers carry opaque account authority rather than provider-name routing', () => {
  const gateway = { request() {} };
  const gmail = new GmailMailProvider({ accountId: 'gmail-account-1', gateway });
  const imap = new ImapSmtpMailProvider({ accountId: 'imap-account-1', gateway });

  assert.equal(gmail.path('/capabilities'), '/accounts/gmail-account-1/capabilities');
  assert.equal(imap.path('/capabilities'), '/accounts/imap-account-1/capabilities');
  assert.equal('providerId' in gmail, false);
  assert.equal('providerId' in imap, false);
});

test('GatewayMailProvider requires an opaque provider account id', () => {
  const gateway = { request() {} };
  assert.throws(() => new GatewayMailProvider({ gateway }), /accountId is required/i);
});
