import test from 'node:test';
import assert from 'node:assert/strict';

import { GatewayMailProvider } from '../web/providers/gateway-mail-provider.js';

function recordingGateway() {
  const calls = [];
  return {
    calls,
    gateway: {
      async request(path, options) {
        calls.push({ path, options });
        return { ok: true };
      },
    },
  };
}

test('GatewayMailProvider rejects non-canonical provider account identifiers', () => {
  const { gateway } = recordingGateway();

  for (const accountId of [' account-1', 'account-1 ', 'account\n1', 'x'.repeat(513)]) {
    assert.throws(
      () => new GatewayMailProvider({ accountId, gateway }),
      /accountId/i,
    );
  }
  assert.throws(
    () => new GatewayMailProvider({ accountId: { id: 'account-1' }, gateway }),
    /accountId/i,
  );
});

test('GatewayMailProvider refuses malformed reader mutation identifiers before gateway invocation', async () => {
  const { calls, gateway } = recordingGateway();
  const provider = new GatewayMailProvider({ accountId: 'account-1', gateway });

  const operations = [
    () => provider.archive(' message-1'),
    () => provider.remove('message-1\n'),
    () => provider.flag(''),
    () => provider.move('message-1', ' inbox'),
    () => provider.updateDraft('draft\u0000-1', { subject: 'Draft' }),
  ];

  for (const operation of operations) {
    await assert.rejects(async () => operation(), TypeError);
  }
  assert.equal(calls.length, 0);
});

test('GatewayMailProvider preserves valid opaque identifier identity across reader mutations', async () => {
  const { calls, gateway } = recordingGateway();
  const provider = new GatewayMailProvider({ accountId: 'account/with spaces', gateway });

  await provider.archive('message/with spaces');
  await provider.move('message/with spaces', 'Archive 2026');

  assert.equal(
    calls[0].path,
    '/accounts/account%2Fwith%20spaces/messages/message%2Fwith%20spaces/archive',
  );
  assert.deepEqual(calls[0].options, { method: 'POST' });
  assert.equal(
    calls[1].path,
    '/accounts/account%2Fwith%20spaces/messages/message%2Fwith%20spaces/move',
  );
  assert.deepEqual(calls[1].options, {
    method: 'POST',
    body: { mailboxId: 'Archive 2026' },
  });
});
