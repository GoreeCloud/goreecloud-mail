import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { MAIL_PROVIDER_CAPABILITY_NAMES } from '../web/mail-provider.js';

async function loadContract() {
  const text = await readFile(
    new URL('../contracts/courier.provider-capabilities.json', import.meta.url),
    'utf8',
  );
  return JSON.parse(text);
}

test('machine-readable provider capability contract matches runtime vocabulary', async () => {
  const contract = await loadContract();

  assert.equal(contract.contract, 'courier.provider-capabilities');
  assert.equal(contract.operatingModel, 'external-provider-client');
  assert.equal(contract.mailServer, false);
  assert.equal(contract.supportsHostedMailService, false);
  assert.deepEqual([...contract.capabilities].sort(), [...MAIL_PROVIDER_CAPABILITY_NAMES].sort());
});

test('provider capability contract excludes hosted mail authority', async () => {
  const contract = await loadContract();
  const capabilities = new Set(contract.capabilities);

  for (const forbidden of contract.forbiddenProviderCapabilities) {
    assert.equal(capabilities.has(forbidden), false, `${forbidden} must not be a provider capability`);
  }

  assert.ok(contract.providerAuthority.includes('mailbox-hosting'));
  assert.ok(contract.providerAuthority.includes('internet-mail-transport'));
});
