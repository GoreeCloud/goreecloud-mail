import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAIL_PROVIDER_CAPABILITY,
  MAIL_PROVIDER_CAPABILITY_NAMES,
  ProviderCapabilityUnavailableError,
  REQUIRED_MAIL_PROVIDER_METHODS,
  normalizeCapabilities,
  requireMailProviderCapability,
  supportsMailProviderCapability,
  validateMailProvider,
} from '../web/mail-provider.js';
import { DemoMailProvider } from '../web/providers/demo-provider.js';

test('demo provider satisfies the mail-provider contract', () => {
  const provider = new DemoMailProvider();
  assert.equal(validateMailProvider(provider), provider);
});

test('mail-provider validator reports missing operations', () => {
  assert.throws(
    () => validateMailProvider({ authenticate() {} }),
    /missing required methods/i,
  );
});

test('capabilities are normalized to explicit booleans', () => {
  const capabilities = normalizeCapabilities({ archive: 1, labels: true, unknown: true });

  assert.equal(capabilities.archive, true);
  assert.equal(capabilities.labels, true);
  assert.equal(capabilities.mailboxAccess, false);
  assert.equal(capabilities.messageRead, false);
  assert.equal(capabilities.attachmentRetrieval, false);
  assert.equal(capabilities.send, false);
  assert.equal(capabilities.serverSideSearch, false);
  assert.equal(capabilities.customDomains, false);
  assert.equal(Object.hasOwn(capabilities, 'unknown'), false);
  assert.equal(Object.keys(capabilities).length, MAIL_PROVIDER_CAPABILITY_NAMES.length);
  assert.equal(Object.isFrozen(capabilities), true);
});

test('provider capability helpers require known and supported capabilities', () => {
  const capabilities = normalizeCapabilities({
    mailboxAccess: true,
    messageRead: true,
    archive: true,
    send: true,
    scheduledSend: false,
  });

  assert.equal(
    supportsMailProviderCapability(capabilities, MAIL_PROVIDER_CAPABILITY.MAILBOX_ACCESS),
    true,
  );
  assert.equal(
    supportsMailProviderCapability(capabilities, MAIL_PROVIDER_CAPABILITY.MESSAGE_READ),
    true,
  );
  assert.equal(
    supportsMailProviderCapability(capabilities, MAIL_PROVIDER_CAPABILITY.ARCHIVE),
    true,
  );
  assert.equal(
    supportsMailProviderCapability(capabilities, MAIL_PROVIDER_CAPABILITY.SCHEDULED_SEND),
    false,
  );
  assert.equal(
    requireMailProviderCapability({
      capabilities,
      capability: MAIL_PROVIDER_CAPABILITY.SEND,
      accountId: 'account-1',
    }),
    true,
  );

  assert.throws(
    () =>
      requireMailProviderCapability({
        capabilities,
        capability: MAIL_PROVIDER_CAPABILITY.SCHEDULED_SEND,
        accountId: 'account-1',
      }),
    (error) =>
      error instanceof ProviderCapabilityUnavailableError &&
      error.code === 'provider-capability-unavailable' &&
      error.capability === MAIL_PROVIDER_CAPABILITY.SCHEDULED_SEND &&
      error.accountId === 'account-1',
  );

  assert.throws(
    () => supportsMailProviderCapability(capabilities, 'mailbox-hosting'),
    /unknown mail provider capability/i,
  );
});

test('required provider contract and capability names remain stable and unique', () => {
  assert.equal(
    new Set(REQUIRED_MAIL_PROVIDER_METHODS).size,
    REQUIRED_MAIL_PROVIDER_METHODS.length,
  );
  assert.equal(
    new Set(MAIL_PROVIDER_CAPABILITY_NAMES).size,
    MAIL_PROVIDER_CAPABILITY_NAMES.length,
  );
  assert.ok(REQUIRED_MAIL_PROVIDER_METHODS.includes('capabilities'));
  assert.ok(REQUIRED_MAIL_PROVIDER_METHODS.includes('sync'));
  assert.ok(MAIL_PROVIDER_CAPABILITY_NAMES.includes('mailboxAccess'));
  assert.ok(MAIL_PROVIDER_CAPABILITY_NAMES.includes('messageRead'));
  assert.ok(MAIL_PROVIDER_CAPABILITY_NAMES.includes('attachmentRetrieval'));
  assert.ok(MAIL_PROVIDER_CAPABILITY_NAMES.includes('pushSync'));
  assert.ok(MAIL_PROVIDER_CAPABILITY_NAMES.includes('storageQuota'));
  assert.ok(MAIL_PROVIDER_CAPABILITY_NAMES.includes('senderIdentities'));
  assert.ok(MAIL_PROVIDER_CAPABILITY_NAMES.includes('providerRules'));
  assert.ok(MAIL_PROVIDER_CAPABILITY_NAMES.includes('customDomains'));
  assert.ok(MAIL_PROVIDER_CAPABILITY_NAMES.includes('retentionControls'));
  assert.ok(!MAIL_PROVIDER_CAPABILITY_NAMES.includes('mailboxHosting'));
  assert.ok(!MAIL_PROVIDER_CAPABILITY_NAMES.includes('mx'));
});

test('demo provider advertises only capabilities implemented by the demo adapter', async () => {
  const provider = new DemoMailProvider();
  const capabilities = await provider.capabilities();

  assert.equal(capabilities.mailboxAccess, true);
  assert.equal(capabilities.messageRead, true);
  assert.equal(capabilities.attachmentRetrieval, false);
  assert.equal(capabilities.archive, true);
  assert.equal(capabilities.move, true);
  assert.equal(capabilities.delete, true);
  assert.equal(capabilities.send, true);
  assert.equal(capabilities.pushSync, false);
  assert.equal(capabilities.customDomains, false);
  assert.equal(capabilities.providerRules, false);
  assert.equal(capabilities.organizationPolicies, false);
});

test('demo provider returns isolated message copies', async () => {
  const provider = new DemoMailProvider();
  const first = await provider.listMessages('inbox');
  const second = await provider.listMessages('inbox');
  first[0].subject = 'mutated';
  assert.notEqual(first[0].subject, second[0].subject);
});
