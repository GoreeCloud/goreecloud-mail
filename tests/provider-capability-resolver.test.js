import test from 'node:test';
import assert from 'node:assert/strict';

import { InMemoryCredentialVault } from '../server/credential-vault.js';
import {
  GMAIL_OAUTH_SCOPE,
  createGmailCapabilityResolver,
  parseGmailGrantedScopes,
  resolveGmailCapabilitiesFromScopes,
} from '../server/gmail-capability-resolver.js';
import { createProviderCapabilityResolver } from '../server/provider-capability-resolver.js';

test('Gmail granted scopes parse from token-response strings and stored arrays', () => {
  assert.deepEqual(
    [...parseGmailGrantedScopes(`${GMAIL_OAUTH_SCOPE.MODIFY} ${GMAIL_OAUTH_SCOPE.SEND}`)].sort(),
    [GMAIL_OAUTH_SCOPE.MODIFY, GMAIL_OAUTH_SCOPE.SEND].sort(),
  );
  assert.deepEqual(
    [...parseGmailGrantedScopes([GMAIL_OAUTH_SCOPE.READONLY, ` ${GMAIL_OAUTH_SCOPE.LABELS} `])].sort(),
    [GMAIL_OAUTH_SCOPE.READONLY, GMAIL_OAUTH_SCOPE.LABELS].sort(),
  );
});

test('gmail.modify enables implemented read, draft, and send Gmail capabilities', () => {
  const capabilities = resolveGmailCapabilitiesFromScopes(GMAIL_OAUTH_SCOPE.MODIFY);

  assert.equal(capabilities.mailboxAccess, true);
  assert.equal(capabilities.messageRead, true);
  assert.equal(capabilities.attachmentRetrieval, true);
  assert.equal(capabilities.labels, true);
  assert.equal(capabilities.send, true);
  assert.equal(capabilities.drafts, true);
  assert.equal(capabilities.incrementalSync, false);
  assert.equal(capabilities.providerRules, false);
});

test('gmail.send enables sending but not draft management or mailbox reads', () => {
  const capabilities = resolveGmailCapabilitiesFromScopes(GMAIL_OAUTH_SCOPE.SEND);

  assert.equal(capabilities.send, true);
  assert.equal(capabilities.drafts, false);
  assert.equal(capabilities.mailboxAccess, false);
  assert.equal(capabilities.messageRead, false);
});

test('gmail.compose enables implemented drafts and sending without mailbox reads', () => {
  const capabilities = resolveGmailCapabilitiesFromScopes(GMAIL_OAUTH_SCOPE.COMPOSE);

  assert.equal(capabilities.send, true);
  assert.equal(capabilities.drafts, true);
  assert.equal(capabilities.mailboxAccess, false);
  assert.equal(capabilities.messageRead, false);
});

test('labels-only authorization exposes labels without message-list or body authority', () => {
  const capabilities = resolveGmailCapabilitiesFromScopes(GMAIL_OAUTH_SCOPE.LABELS);

  assert.equal(capabilities.mailboxAccess, false);
  assert.equal(capabilities.labels, true);
  assert.equal(capabilities.messageRead, false);
  assert.equal(capabilities.attachmentRetrieval, false);
});

test('missing Gmail credential authorization fails closed', async () => {
  const credentialVault = new InMemoryCredentialVault();
  const resolver = createGmailCapabilityResolver({ credentialVault });
  const capabilities = await resolver({
    account: { id: 'account-a', provider: 'gmail' },
    userId: 'user-a',
  });

  assert.equal(Object.values(capabilities).some(Boolean), false);
});

test('Gmail capability resolver uses the user/account scoped credential record', async () => {
  const credentialVault = new InMemoryCredentialVault();
  credentialVault.put({
    userId: 'user-a',
    accountId: 'account-a',
    provider: 'gmail',
    secret: { scope: `${GMAIL_OAUTH_SCOPE.READONLY} ${GMAIL_OAUTH_SCOPE.SEND}` },
  });
  credentialVault.put({
    userId: 'user-b',
    accountId: 'account-b',
    provider: 'gmail',
    secret: { scope: GMAIL_OAUTH_SCOPE.SEND },
  });

  const resolver = createGmailCapabilityResolver({ credentialVault });
  const alice = await resolver({ account: { id: 'account-a', provider: 'gmail' }, userId: 'user-a' });
  const bob = await resolver({ account: { id: 'account-b', provider: 'gmail' }, userId: 'user-b' });

  assert.equal(alice.messageRead, true);
  assert.equal(alice.send, true);
  assert.equal(alice.drafts, false);
  assert.equal(bob.messageRead, false);
  assert.equal(bob.send, true);
  assert.equal(bob.drafts, false);
});

test('provider dispatcher fails closed for providers without an implemented resolver', async () => {
  const credentialVault = new InMemoryCredentialVault();
  const resolver = createProviderCapabilityResolver({ credentialVault });
  const capabilities = await resolver({
    account: { id: 'outlook-a', provider: 'microsoft-outlook' },
    userId: 'user-a',
  });

  assert.equal(Object.values(capabilities).some(Boolean), false);
});
