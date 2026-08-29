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
  assert.equal(built.contentType, 'text/plain');
  assert.doesNotMatch(built.raw, /=/);
});

test('rich Gmail composition emits deterministic sanitized multipart alternative content', () => {
  const input = {
    to: 'alice@example.test',
    subject: 'Rich status',
    body: 'Plain fallback\nSecond line',
    html: '<p style="color:red" onclick="steal()">Rich <strong>status</strong></p><img src="https://tracker.example/pixel"><script>alert(1)</script><a href="https://example.test/path">Details</a>',
  };
  const first = buildGmailRawMessage(input);
  const second = buildGmailRawMessage(input);
  const decoded = decodeGmailRawMessage(first.raw);

  assert.equal(first.raw, second.raw);
  assert.equal(first.contentType, 'multipart/alternative');
  assert.match(decoded, /Content-Type: multipart\/alternative; boundary="goreecloud-alt-[a-f0-9]{32}"/);
  assert.match(decoded, /Content-Type: text\/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\nPlain fallback\r\nSecond line/);
  assert.match(decoded, /Content-Type: text\/html; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit/);
  assert.match(decoded, /<p>Rich <strong>status<\/strong><\/p>/);
  assert.match(decoded, /<a href="https:\/\/example\.test\/path">Details<\/a>/);
  assert.doesNotMatch(decoded, /style=/i);
  assert.doesNotMatch(decoded, /onclick=/i);
  assert.doesNotMatch(decoded, /<script/i);
  assert.doesNotMatch(decoded, /tracker\.example/);
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

test('message builder requires a recipient and bounds plain and HTML body bytes', () => {
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
  assert.throws(
    () => buildGmailRawMessage({
      to: 'alice@example.test',
      body: 'fallback',
      html: 'x'.repeat(GMAIL_MESSAGE_LIMITS.htmlBytes + 1),
    }),
    (error) => error.code === 'invalid-request' && error.status === 413,
  );
});
