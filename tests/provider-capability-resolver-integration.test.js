import test from 'node:test';
import assert from 'node:assert/strict';

import { InMemoryCredentialVault } from '../server/credential-vault.js';
import { GMAIL_OAUTH_SCOPE } from '../server/gmail-capability-resolver.js';
import { GmailAccountService } from '../server/gmail-account-service.js';
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
  assert.equal(result.capabilities.send, true);
  assert.equal(result.capabilities.drafts, true);
});

test('labels-only Gmail scope can list labels but cannot list messages', async () => {
  const registry = new InMemoryProviderAccountRegistry();
  const credentialVault = new InMemoryCredentialVault();
  const capabilityResolver = createProviderCapabilityResolver({ credentialVault });
  const accountService = new ProviderAccountService({ registry, capabilityResolver });
  const calls = [];
  const gmail = new GmailAccountService({
    accountService,
    gmailClientFactory: () => ({
      listLabels: async () => {
        calls.push('labels');
        return [];
      },
      listMessages: async () => {
        calls.push('messages');
        return { messageRefs: [] };
      },
    }),
  });

  const account = accountService.create({ session: { userId: 'user-a' }, provider: 'gmail' });
  credentialVault.put({
    userId: 'user-a',
    accountId: account.id,
    provider: 'gmail',
    secret: { scope: GMAIL_OAUTH_SCOPE.LABELS },
  });

  await gmail.listLabels({ session: { userId: 'user-a' }, accountId: account.id });
  assert.deepEqual(calls, ['labels']);

  await assert.rejects(
    gmail.listMessages({ session: { userId: 'user-a' }, accountId: account.id }),
    (error) => error.code === 'provider-capability-unavailable' && error.capability === 'mailboxAccess',
  );
  assert.deepEqual(calls, ['labels']);
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
