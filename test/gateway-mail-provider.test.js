import test from 'node:test';
import assert from 'node:assert/strict';

import { GatewayMailProvider } from '../web/providers/gateway-mail-provider.js';
import { ProviderGateway } from '../web/providers/provider-gateway.js';

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

  await gateway.request('/providers/gmail/messages', {
    method: 'POST',
    body: { subject: 'Hello' },
  });

  assert.equal(calls[0].url, '/api/mail/providers/gmail/messages');
  assert.equal(calls[0].options.credentials, 'same-origin');
  assert.equal(calls[0].options.headers['content-type'], 'application/json');
  assert.equal(calls[0].options.body, JSON.stringify({ subject: 'Hello' }));
});

test('GatewayMailProvider encodes identifiers and delegates through the gateway', async () => {
  const calls = [];
  const gateway = {
    async request(path, options) {
      calls.push({ path, options });
      if (path.endsWith('/capabilities')) return { search: true, send: true };
      return { ok: true };
    },
  };

  const provider = new GatewayMailProvider({ providerId: 'gmail', gateway });
  await provider.getMessage('message/with spaces');
  const capabilities = await provider.capabilities();

  assert.equal(calls[0].path, '/providers/gmail/messages/message%2Fwith%20spaces');
  assert.equal(capabilities.search, true);
  assert.equal(capabilities.send, true);
  assert.equal(capabilities.archive, false);
});
