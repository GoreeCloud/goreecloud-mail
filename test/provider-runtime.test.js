import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createMailProviderRuntime,
  normalizeSameOriginGatewayBase,
  readMailProviderRuntime,
} from '../web/provider-runtime.js';

test('browser provider runtime defaults to local demo mode', () => {
  const runtime = createMailProviderRuntime();
  assert.equal(runtime.mode, 'demo');
  assert.equal(runtime.label, 'Demo provider');
  assert.equal(runtime.canSendAttachments, false);
});

test('gateway mode requires a non-secret account id and same-origin path', () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({}) });
  assert.throws(
    () => createMailProviderRuntime({ mode: 'gateway', fetchImpl }),
    /account identifier/i,
  );
  for (const base of ['https://mail.example/api', '//example.test/api', '/api/mail?token=secret', '/api/mail#fragment']) {
    assert.throws(
      () => createMailProviderRuntime({ mode: 'gateway', accountId: 'account-1', gatewayBaseUrl: base, fetchImpl }),
      /gateway base/i,
    );
  }

  const runtime = createMailProviderRuntime({
    mode: 'gateway',
    accountId: 'account-1',
    gatewayBaseUrl: '/api/mail/',
    fetchImpl,
  });
  assert.equal(runtime.mode, 'gateway');
  assert.equal(runtime.label, 'Authenticated gateway');
  assert.equal(runtime.canSendAttachments, true);
});

test('same-origin gateway normalization remains root-relative and bounded', () => {
  assert.equal(normalizeSameOriginGatewayBase('/api/mail/'), '/api/mail');
  assert.equal(normalizeSameOriginGatewayBase('/'), '/');
  assert.throws(() => normalizeSameOriginGatewayBase('api/mail'), /same-origin/i);
  assert.throws(() => normalizeSameOriginGatewayBase('/api\nmail'), /unsupported/i);
});

test('document metadata selects gateway without accepting browser credentials', () => {
  const values = new Map([
    ['goreecloud-mail-provider', 'gateway'],
    ['goreecloud-mail-account', 'account-42'],
    ['goreecloud-mail-gateway', '/api/mail'],
  ]);
  const documentRef = {
    querySelector(selector) {
      const match = selector.match(/^meta\[name="([^"]+)"\]$/);
      return match && values.has(match[1]) ? { content: values.get(match[1]) } : null;
    },
  };
  const runtime = readMailProviderRuntime(documentRef, async () => ({ ok: true, json: async () => ({}) }));
  assert.equal(runtime.mode, 'gateway');
  assert.equal(runtime.provider.accountId, 'account-42');
  assert.equal('accessToken' in runtime, false);
  assert.equal('refreshToken' in runtime, false);
});
