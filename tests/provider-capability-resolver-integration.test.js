import test from 'node:test';
import assert from 'node:assert/strict';

import { InMemoryCredentialVault } from '../server/credential-vault.js';
import { GMAIL_OAUTH_SCOPE } from '../server/gmail-capability-resolver.js';
import { InMemoryProviderAccountRegistry } from '../server/provider-account-registry.js';
import { ProviderAccountService } from '../server/provider-account-service.js';
import { createProviderCapabilityResolver } from '../server/provider-capability-resolver.js';

test('ProviderAccountService resolves Gmail capabilities from the owned account credential scopes', async () => {
  const registry = new InMemoryProviderAccountRegistry();
  const credentialVault = new InMemoryCredentialVault();
  const capabilityResolver = createProviderCapabilityResolver({ credentialVault });
  const accountService = new ProviderAccountService({ registry, capabilityResolver });

  const account = accountService.create({
    session: { userId: 'user-a' },
    provider: 'gmail',
    externalAccountId: 'external-a',
  });
  credentialVault.put({
    userId: 'user-a',
    accountId: account.id,
    provider: 'gmail',
    secret: { scope: GMAIL_OAUTH_SCOPE.MODIFY },
  });

  const result = await accountService.capabilities({
    session: { userId: 'user-a' },
    accountId: account.id,
  });

  assert.equal(result.accountId, account.id);
  assert.equal(result.provider, 'gmail');
  assert.equal(result.capabilities.mailboxAccess, true);
  assert.equal(result.capabilities.messageRead, true);
  assert.equal(result.capabilities.attachmentRetrieval, true);
  assert.equal(result.capabilities.labels, true);
  assert.equal(result.capabilities.send, false);
});

test('cross-user capability lookup fails before credential scopes can be reused', async () => {
  const registry = new InMemoryProviderAccountRegistry();
  const credentialVault = new InMemoryCredentialVault();
  const capabilityResolver = createProviderCapabilityResolver({ credentialVault });
  const accountService = new ProviderAccountService({ registry, capabilityResolver });

  const account = accountService.create({ session: { userId: 'user-a' }, provider: 'gmail' });
  credentialVault.put({
    userId: 'user-a',
    accountId: account.id,
    provider: 'gmail',
    secret: { scope: GMAIL_OAUTH_SCOPE.MODIFY },
  });

  await assert.rejects(
    accountService.capabilities({ session: { userId: 'user-b' }, accountId: account.id }),
    (error) => error.code === 'provider-account-not-found' && error.status === 404,
  );
});
