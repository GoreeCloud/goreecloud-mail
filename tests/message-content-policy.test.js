import test from 'node:test';
import assert from 'node:assert/strict';

import { MessageContentPolicy, UnsafeMessageHtmlError, escapeHtml } from '../server/message-content-policy.js';

test('plain text is escaped and remote content remains blocked', () => {
  const policy = new MessageContentPolicy();
  assert.deepEqual(policy.render({ text: '<b>Hello & goodbye</b>' }), {
    kind: 'text',
    content: '&lt;b&gt;Hello &amp; goodbye&lt;/b&gt;',
    remoteContentAllowed: false,
  });
});

test('HTML fails closed when no approved sanitizer is configured', () => {
  const policy = new MessageContentPolicy();
  assert.throws(() => policy.render({ html: '<p>Hello</p>' }), UnsafeMessageHtmlError);
});

test('obviously active markup is rejected before and after sanitization', () => {
  const passthrough = new MessageContentPolicy({ sanitizeHtml: (html) => html });
  assert.throws(() => passthrough.render({ html: '<img src=x onerror=alert(1)>' }), UnsafeMessageHtmlError);

  const maliciousSanitizer = new MessageContentPolicy({ sanitizeHtml: () => '<script>alert(1)</script>' });
  assert.throws(() => maliciousSanitizer.render({ html: '<p>Hello</p>' }), UnsafeMessageHtmlError);
});

test('sanitized HTML is returned with remote content disabled', () => {
  const policy = new MessageContentPolicy({ sanitizeHtml: () => '<p>Hello <strong>world</strong></p>' });
  assert.deepEqual(policy.render({ html: '<p>Hello</p>' }), {
    kind: 'html',
    content: '<p>Hello <strong>world</strong></p>',
    remoteContentAllowed: false,
  });
});

test('escapeHtml handles attribute-significant characters', () => {
  assert.equal(escapeHtml(`"'&<>`), '&quot;&#39;&amp;&lt;&gt;');
});
