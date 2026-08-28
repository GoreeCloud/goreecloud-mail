import test from 'node:test';
import assert from 'node:assert/strict';

import { requireSessionUser } from '../server/session-context.js';
import {
  InMemoryProviderAccountRegistry,
  ProviderAccountNotFoundError,
} from '../server/provider-account-registry.js';
import {
  InMemoryOAuthStateStore,
  OAuthStateError,
  isApprovedRedirectPath,
} from '../server/oauth-state-store.js';

test('session identity is derived only from trusted server session state', () => {
  assert.deepEqual(requireSessionUser({ userId: 'user-a' }), { userId: 'user-a' });
  assert.throws(() => requireSessionUser({}), /authentication is required/i);
});

test('provider accounts are isolated by GoreeCloud user identity', () => {
  const registry = new InMemoryProviderAccountRegistry();
  const account = registry.create({
    userId: 'user-a',
    provider: 'gmail',
    externalAccountId: 'external-a',
    displayName: 'Primary mail',
  });

  assert.equal(registry.getForUser('user-a', account.id).provider, 'gmail');
  assert.throws(
    () => registry.getForUser('user-b', account.id),
    ProviderAccountNotFoundError,
  );
  assert.equal(registry.listForUser('user-b').length, 0);
});

test('provider account public records never expose the owning user id', () => {
  const registry = new InMemoryProviderAccountRegistry();
  const account = registry.create({ userId: 'private-user', provider: 'imap-smtp' });
  assert.equal('userId' in account, false);
  assert.doesNotMatch(JSON.stringify(account), /private-user/);
});

test('OAuth state is user-scoped, provider-scoped, and single use', () => {
  let now = 1000;
  const store = new InMemoryOAuthStateStore({ ttlMs: 100, now: () => now });
  const state = store.issue({ userId: 'user-a', provider: 'gmail', redirectPath: '/inbox' });

  assert.throws(
    () => store.consume({ state, userId: 'user-b', provider: 'gmail' }),
    OAuthStateError,
  );
  assert.throws(
    () => store.consume({ state, userId: 'user-a', provider: 'gmail' }),
    OAuthStateError,
  );

  const fresh = store.issue({ userId: 'user-a', provider: 'gmail', redirectPath: '/inbox' });
  assert.deepEqual(store.consume({ state: fresh, userId: 'user-a', provider: 'gmail' }), {
    redirectPath: '/inbox',
  });
  assert.throws(
    () => store.consume({ state: fresh, userId: 'user-a', provider: 'gmail' }),
    OAuthStateError,
  );

  const expired = store.issue({ userId: 'user-a', provider: 'gmail' });
  now += 101;
  assert.throws(
    () => store.consume({ state: expired, userId: 'user-a', provider: 'gmail' }),
    OAuthStateError,
  );
});

test('OAuth redirects are restricted to application-relative paths', () => {
  assert.equal(isApprovedRedirectPath('/inbox?account=1'), true);
  assert.equal(isApprovedRedirectPath('https://attacker.example/'), false);
  assert.equal(isApprovedRedirectPath('//attacker.example/'), false);
  assert.equal(isApprovedRedirectPath('inbox'), false);
});
