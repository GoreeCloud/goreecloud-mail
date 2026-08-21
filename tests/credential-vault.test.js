import test from 'node:test';
import assert from 'node:assert/strict';

import { CredentialNotFoundError, InMemoryCredentialVault } from '../server/credential-vault.js';

test('credential vault scopes secrets by user and account', () => {
  const vault = new InMemoryCredentialVault();
  vault.put({ userId: 'user-a', accountId: 'acct-1', provider: 'gmail', secret: { accessToken: 'secret-a' } });

  assert.deepEqual(vault.get({ userId: 'user-a', accountId: 'acct-1' }), { accessToken: 'secret-a' });
  assert.throws(() => vault.get({ userId: 'user-b', accountId: 'acct-1' }), CredentialNotFoundError);
});

test('credential descriptors do not expose secret material', () => {
  const vault = new InMemoryCredentialVault();
  const descriptor = vault.put({
    userId: 'user-a',
    accountId: 'acct-1',
    provider: 'gmail',
    secret: { refreshToken: 'do-not-leak', accessToken: 'also-private' },
  });

  assert.equal(descriptor.configured, true);
  assert.equal(descriptor.provider, 'gmail');
  assert.doesNotMatch(JSON.stringify(descriptor), /do-not-leak|also-private/);
});

test('credential reads return copies and removal invalidates access', () => {
  const vault = new InMemoryCredentialVault();
  vault.put({ userId: 'user-a', accountId: 'acct-1', provider: 'gmail', secret: { nested: { token: 'value' } } });

  const first = vault.get({ userId: 'user-a', accountId: 'acct-1' });
  first.nested.token = 'mutated';
  assert.equal(vault.get({ userId: 'user-a', accountId: 'acct-1' }).nested.token, 'value');

  vault.remove({ userId: 'user-a', accountId: 'acct-1' });
  assert.throws(() => vault.get({ userId: 'user-a', accountId: 'acct-1' }), CredentialNotFoundError);
});
