import test from 'node:test';
import assert from 'node:assert/strict';

import { buildForwardCompose, buildReplyCompose } from '../web/compose-context.js';

const message = {
  sender: 'Ada Example',
  address: 'ada@example.com',
  subject: 'Project update',
  body: 'First line\r\nSecond line',
};

test('reply targets the authenticated message sender and quotes plain text only', () => {
  assert.deepEqual(buildReplyCompose(message, 'Aug 30, 9:15 PM'), {
    to: 'ada@example.com',
    subject: 'Re: Project update',
    body: '\n\nOn Aug 30, 9:15 PM, Ada Example <ada@example.com> wrote:\n> First line\n> Second line',
  });
});

test('reply does not stack an existing Re prefix', () => {
  assert.equal(
    buildReplyCompose({ ...message, subject: 'RE: Project update' }, 'Aug 30').subject,
    'RE: Project update',
  );
});

test('forward leaves recipients empty and preserves the original as plain text', () => {
  const result = buildForwardCompose(message, 'Aug 30, 9:15 PM');
  assert.equal(result.to, '');
  assert.equal(result.subject, 'Fwd: Project update');
  assert.match(result.body, /From: Ada Example <ada@example\.com>/);
  assert.match(result.body, /Subject: Project update/);
  assert.match(result.body, /First line\r\nSecond line/);
});

test('compose context rejects messages without a sender address', () => {
  assert.throws(
    () => buildReplyCompose({ ...message, address: '   ' }, 'Aug 30'),
    /sender address is required/i,
  );
});
