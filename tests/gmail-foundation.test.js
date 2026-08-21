import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildGmailAuthorizationUrl,
  buildGmailTokenExchangeBody,
  createPkcePair,
} from '../server/gmail-oauth.js';
import { normalizeGmailLabel, normalizeGmailMessage } from '../server/gmail-normalizer.js';

test('PKCE pair uses S256 and produces distinct verifier/challenge values', () => {
  const pair = createPkcePair();
  assert.equal(pair.method, 'S256');
  assert.ok(pair.verifier.length > 40);
  assert.ok(pair.challenge.length > 40);
  assert.notEqual(pair.verifier, pair.challenge);
});

test('Gmail authorization URL contains state and PKCE without client secret', () => {
  const url = new URL(buildGmailAuthorizationUrl({
    clientId: 'client-id',
    redirectUri: 'https://mail.example.test/oauth/google/callback',
    state: 'state-value',
    codeChallenge: 'challenge-value',
  }));
  assert.equal(url.searchParams.get('client_id'), 'client-id');
  assert.equal(url.searchParams.get('state'), 'state-value');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.has('client_secret'), false);
});

test('token exchange body contains authorization code and verifier', () => {
  const body = buildGmailTokenExchangeBody({
    clientId: 'client-id',
    redirectUri: 'https://mail.example.test/oauth/google/callback',
    code: 'authorization-code',
    codeVerifier: 'verifier',
  });
  assert.equal(body.get('grant_type'), 'authorization_code');
  assert.equal(body.get('code'), 'authorization-code');
  assert.equal(body.get('code_verifier'), 'verifier');
});

test('Gmail messages normalize to provider-independent summary records', () => {
  const normalized = normalizeGmailMessage({
    id: 'm1',
    threadId: 't1',
    internalDate: '1720000000000',
    snippet: 'Hello there',
    labelIds: ['INBOX', 'UNREAD', 'STARRED'],
    sizeEstimate: 42,
    payload: {
      headers: [
        { name: 'Subject', value: 'Test message' },
        { name: 'From', value: 'Sender <sender@example.test>' },
        { name: 'To', value: 'One <one@example.test>, Two <two@example.test>' },
      ],
      parts: [{ filename: 'report.pdf', body: { attachmentId: 'a1' } }],
    },
  });
  assert.equal(normalized.id, 'm1');
  assert.equal(normalized.subject, 'Test message');
  assert.equal(normalized.unread, true);
  assert.equal(normalized.starred, true);
  assert.equal(normalized.hasAttachments, true);
  assert.equal(normalized.to.length, 2);
});

test('Gmail labels normalize system/user type and counts', () => {
  assert.deepEqual(normalizeGmailLabel({ id: 'INBOX', name: 'INBOX', type: 'system', messagesTotal: 4 }), {
    id: 'INBOX',
    name: 'INBOX',
    type: 'system',
    messagesTotal: 4,
    messagesUnread: null,
    threadsTotal: null,
    threadsUnread: null,
  });
});
