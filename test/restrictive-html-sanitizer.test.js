import test from 'node:test';
import assert from 'node:assert/strict';

import { MessageContentPolicy } from '../server/message-content-policy.js';
import { sanitizeMessageHtml } from '../server/restrictive-html-sanitizer.js';

test('sanitizer removes active containers and event/style attributes', () => {
  const sanitized = sanitizeMessageHtml('<p onclick="steal()" style="background:url(https://tracker.test/x)">Hello</p><script>alert(1)</script>');
  assert.equal(sanitized, '<p>Hello</p>');
});

test('sanitizer removes automatic remote resource attributes', () => {
  const sanitized = sanitizeMessageHtml('<img src="https://tracker.test/pixel" srcset="https://tracker.test/a 1x"><video poster="https://tracker.test/p.jpg"></video>');
  assert.equal(sanitized, '<img><video></video>');
});

test('sanitizer preserves only explicitly permitted href forms', () => {
  const sanitized = sanitizeMessageHtml('<a href="https://example.com">web</a><a href="mailto:user@example.com">mail</a><a href="javascript:alert(1)">bad</a><a href="http://example.com">plain-http</a>');
  assert.equal(sanitized, '<a href="https://example.com">web</a><a href="mailto:user@example.com">mail</a><a>bad</a><a>plain-http</a>');
});

test('message policy accepts sanitized inert HTML and keeps remote content disabled', () => {
  const policy = new MessageContentPolicy({ sanitizeHtml: sanitizeMessageHtml });
  const result = policy.render({ html: '<p>Hello <strong>world</strong>.</p><img src="https://tracker.test/pixel">' });
  assert.deepEqual(result, {
    kind: 'html',
    content: '<p>Hello <strong>world</strong>.</p><img>',
    remoteContentAllowed: false,
  });
});

test('message policy still fails closed before sanitizer for obviously active markup', () => {
  const policy = new MessageContentPolicy({ sanitizeHtml: sanitizeMessageHtml });
  assert.throws(() => policy.render({ html: '<script>alert(1)</script><p>Hello</p>' }), /approved sanitizer/);
});
