import test from 'node:test';
import assert from 'node:assert/strict';

import { routeMailApi } from '../server/mail-api-router.js';
import { ProviderAccountService } from '../server/provider-account-service.js';
import { InMemoryProviderAccountRegistry } from '../server/provider-account-registry.js';
import { GatewayMailProvider } from '../web/providers/gateway-mail-provider.js';
import { ProviderGateway } from '../web/providers/provider-gateway.js';

function webResponse(result) {
  return new Response(JSON.stringify(structuredClone(result.body)), {
    status: result.status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

test('account-scoped capability discovery survives the trusted API and browser gateway boundary', async () => {
  const registry = new InMemoryProviderAccountRegistry();
  const accountService = new ProviderAccountService({
    registry,
    capabilityResolver: async ({ account }) =>
      account.provider === 'gmail'
        ? {
            mailboxAccess: true,
            messageRead: true,
            attachmentRetrieval: true,
            labels: true,
            send: false,
          }
        : {},
  });
  const account = accountService.create({
    session: { userId: 'alice' },
    provider: 'gmail',
    externalAccountId: 'alice@example.test',
  });

  const gateway = new ProviderGateway({
    baseUrl: '/api/mail/',
    fetchImpl: async (url, options) => {
      const parsed = new URL(url, 'https://mail.goreecloud.test');
      const result = await routeMailApi({
        method: options.method,
        pathname: parsed.pathname,
        session: { userId: 'alice' },
        accountService,
      });
      return webResponse(result);
    },
  });
  const provider = new GatewayMailProvider({ accountId: account.id, gateway });

  const capabilities = await provider.capabilities();

  assert.equal(capabilities.mailboxAccess, true);
  assert.equal(capabilities.messageRead, true);
  assert.equal(capabilities.attachmentRetrieval, true);
  assert.equal(capabilities.labels, true);
  assert.equal(capabilities.send, false);
  assert.equal(capabilities.customDomains, false);
});

test('capability discovery through the gateway cannot use another users opaque account id', async () => {
  const registry = new InMemoryProviderAccountRegistry();
  const accountService = new ProviderAccountService({
    registry,
    capabilityResolver: async () => ({ mailboxAccess: true }),
  });
  const account = accountService.create({ session: { userId: 'alice' }, provider: 'gmail' });

  const gateway = new ProviderGateway({
    baseUrl: '/api/mail/',
    fetchImpl: async (url, options) => {
      const parsed = new URL(url, 'https://mail.goreecloud.test');
      const result = await routeMailApi({
        method: options.method,
        pathname: parsed.pathname,
        session: { userId: 'bob' },
        accountService,
      });
      return webResponse(result);
    },
  });
  const provider = new GatewayMailProvider({ accountId: account.id, gateway });

  await assert.rejects(
    provider.capabilities(),
    (error) =>
      error.code === 'provider-account-not-found' &&
      error.status === 404 &&
      error.retryable === false,
  );
});