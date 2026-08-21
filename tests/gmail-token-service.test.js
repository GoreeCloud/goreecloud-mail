import test from 'node:test';
import assert from 'node:assert/strict';

import { InMemoryCredentialVault, CredentialNotFoundError } from '../server/credential-vault.js';
import { GmailTokenService } from '../server/gmail-token-service.js';

const userId = 'user-a';
const accountId = 'account-a';

test('returns a still-valid cached access token without refreshing', async () => {
  const vault = new InMemoryCredentialVault();
  vault.put({ userId, accountId, provider: 'gmail', secret: { accessToken: 'cached-token', refreshToken: 'refresh-token', expiresAt: 500000 } });
  let calls = 0;
  const service = new GmailTokenService({ credentialVault: vault, now: () => 100000, fetchImpl: async () => { calls += 1; throw new Error('unexpected'); } });
  assert.equal(await service.resolveAccessToken({ userId, accountId, clientId: 'client-id' }), 'cached-token');
  assert.equal(calls, 0);
});

test('refreshes expired access tokens and preserves refresh token when omitted', async () => {
  const vault = new InMemoryCredentialVault();
  vault.put({ userId, accountId, provider: 'gmail', secret: { accessToken: 'expired', refreshToken: 'refresh-token', expiresAt: 1 } });
  const service = new GmailTokenService({
    credentialVault: vault,
    now: () => 1000,
    fetchImpl: async (_url, options) => {
      assert.match(String(options.body), /refresh_token=refresh-token/);
      return { ok: true, json: async () => ({ access_token: 'new-token', expires_in: 3600, token_type: 'Bearer' }) };
    },
  });
  assert.equal(await service.resolveAccessToken({ userId, accountId, clientId: 'client-id' }), 'new-token');
  const stored = vault.get({ userId, accountId });
  assert.equal(stored.accessToken, 'new-token');
  assert.equal(stored.refreshToken, 'refresh-token');
  assert.equal(stored.expiresAt, 3601000);
});

test('fails with auth-required when no refresh token exists', async () => {
  const vault = new InMemoryCredentialVault();
  vault.put({ userId, accountId, provider: 'gmail', secret: { accessToken: 'expired', expiresAt: 1 } });
  const service = new GmailTokenService({ credentialVault: vault, now: () => 1000, fetchImpl: async () => { throw new Error('unexpected'); } });
  await assert.rejects(
    service.resolveAccessToken({ userId, accountId, clientId: 'client-id' }),
    (error) => error.code === 'auth-required' && error.status === 401,
  );
});

test('revocation calls Google with the refresh token before removing local authorization state', async () => {
  const vault = new InMemoryCredentialVault();
  vault.put({ userId, accountId, provider: 'gmail', secret: { accessToken: 'access-token', refreshToken: 'refresh-token' } });
  let request;
  const service = new GmailTokenService({
    credentialVault: vault,
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true };
    },
  });

  assert.deepEqual(await service.revoke({ userId, accountId }), { revoked: true });
  assert.match(request.url, /oauth2\.googleapis\.com\/revoke/);
  assert.equal(new URLSearchParams(String(request.options.body)).get('token'), 'refresh-token');
  assert.throws(() => vault.get({ userId, accountId }), CredentialNotFoundError);
});

test('failed upstream revocation retains local authorization state for safe retry', async () => {
  const vault = new InMemoryCredentialVault();
  vault.put({ userId, accountId, provider: 'gmail', secret: { refreshToken: 'refresh-token' } });
  const service = new GmailTokenService({
    credentialVault: vault,
    fetchImpl: async () => ({ ok: false, status: 503 }),
  });

  await assert.rejects(service.revoke({ userId, accountId }), (error) => error.retryable === true);
  assert.equal(vault.get({ userId, accountId }).refreshToken, 'refresh-token');
});

test('local-only revocation is available for already-invalid upstream credentials', async () => {
  const vault = new InMemoryCredentialVault();
  vault.put({ userId, accountId, provider: 'gmail', secret: { refreshToken: 'refresh-token' } });
  const service = new GmailTokenService({ credentialVault: vault, fetchImpl: async () => { throw new Error('unexpected'); } });
  assert.deepEqual(await service.revoke({ userId, accountId, revokeUpstream: false }), { revoked: true });
  assert.throws(() => vault.get({ userId, accountId }), CredentialNotFoundError);
});
