import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REQUIRED_MAIL_PROVIDER_METHODS,
  normalizeCapabilities,
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
  const capabilities = normalizeCapabilities({ archive: 1, labels: true });
  assert.deepEqual(capabilities, {
    archive: true,
    drafts: false,
    flags: false,
    folders: false,
    labels: true,
    search: false,
    send: false,
    threads: false,
  });
});

test('required provider contract remains stable and unique', () => {
  assert.equal(
    new Set(REQUIRED_MAIL_PROVIDER_METHODS).size,
    REQUIRED_MAIL_PROVIDER_METHODS.length,
  );
  assert.ok(REQUIRED_MAIL_PROVIDER_METHODS.includes('capabilities'));
  assert.ok(REQUIRED_MAIL_PROVIDER_METHODS.includes('sync'));
});

test('demo provider returns isolated message copies', async () => {
  const provider = new DemoMailProvider();
  const first = await provider.listMessages('inbox');
  const second = await provider.listMessages('inbox');
  first[0].subject = 'mutated';
  assert.notEqual(first[0].subject, second[0].subject);
});
