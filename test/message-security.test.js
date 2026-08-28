import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyMessageUrl, remoteContentPolicy } from '../web/security/message-security.js';

test('message URLs block executable and unsupported schemes', () => {
  assert.equal(classifyMessageUrl('javascript:alert(1)').allowed, false);
  assert.equal(classifyMessageUrl('data:text/html,hello').allowed, false);
  assert.equal(classifyMessageUrl('http://example.com').allowed, false);
});

test('message URLs allow HTTPS and mailto with explicit classification', () => {
  const https = classifyMessageUrl('https://example.com/path');
  const mailto = classifyMessageUrl('mailto:person@example.com');

  assert.equal(https.allowed, true);
  assert.equal(https.external, true);
  assert.equal(mailto.allowed, true);
  assert.equal(mailto.reason, 'mail-address');
});

test('remote content remains blocked until both trust and user approval exist', () => {
  assert.deepEqual(remoteContentPolicy(), {
    allowed: false,
    mode: 'blocked',
    reason: 'privacy-by-default',
  });

  assert.equal(remoteContentPolicy({ trustedSender: true }).allowed, false);
  assert.equal(remoteContentPolicy({ userApproved: true }).allowed, false);
  assert.equal(remoteContentPolicy({ trustedSender: true, userApproved: true }).allowed, true);
});
