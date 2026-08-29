import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GMAIL_MESSAGE_LIMITS,
  buildGmailRawMessage,
  decodeGmailRawMessage,
} from '../server/gmail-message-builder.js';

test('Gmail message builder emits base64url RFC message with normalized CRLF', () => {
  const built = buildGmailRawMessage({
    to: ['alice@example.test', 'bob@example.test'],
    cc: 'carol@example.test',
    subject: 'Status',
    body: 'Line one\nLine two',
  });
  const decoded = decodeGmailRawMessage(built.raw);

  assert.match(decoded, /^To: alice@example\.test, bob@example\.test\r\n/);
  assert.match(decoded, /Cc: carol@example\.test\r\n/);
  assert.match(decoded, /Subject: Status\r\n/);
  assert.match(decoded, /Content-Type: text\/plain; charset=UTF-8\r\n/);
  assert.match(decoded, /\r\n\r\nLine one\r\nLine two$/);
  assert.equal(built.recipientCount, 3);
  assert.doesNotMatch(built.raw, /=/);
});

test('non-ASCII subjects use an encoded-word header', () => {
  const decoded = decodeGmailRawMessage(
    buildGmailRawMessage({ to: 'alice@example.test', subject: 'Résumé ✓', body: 'Hello' }).raw,
  );
  assert.match(decoded, /Subject: =\?UTF-8\?B\?.+\?=/);
  assert.doesNotMatch(decoded, /Subject: Résumé/);
});

test('message builder rejects header injection', () => {
  assert.throws(
    () => buildGmailRawMessage({
      to: 'alice@example.test\r\nBcc: attacker@example.test',
      subject: 'Hello',
      body: 'Body',
    }),
    (error) => error.code === 'invalid-request' && error.status === 400,
  );
  assert.throws(
    () => buildGmailRawMessage({
      to: 'alice@example.test',
      subject: 'Hello\nBcc: attacker@example.test',
      body: 'Body',
    }),
    (error) => error.code === 'invalid-request' && error.status === 400,
  );
});

test('message builder requires a recipient and bounds body bytes', () => {
  assert.throws(
    () => buildGmailRawMessage({ subject: 'No recipient', body: 'Body' }),
    (error) => error.code === 'invalid-request' && error.status === 400,
  );
  assert.throws(
    () => buildGmailRawMessage({
      to: 'alice@example.test',
      body: 'x'.repeat(GMAIL_MESSAGE_LIMITS.bodyBytes + 1),
    }),
    (error) => error.code === 'invalid-request' && error.status === 413,
  );
});
