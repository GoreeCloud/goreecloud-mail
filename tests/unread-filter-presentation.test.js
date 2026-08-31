import assert from 'node:assert/strict';
import test from 'node:test';

import {
  shouldShowRenderedMessage,
  unreadFilterStatus,
} from '../web/unread-filter-presentation.js';

test('unread-only presentation is a pure projection of loaded provider state', () => {
  assert.equal(shouldShowRenderedMessage({ unreadOnly: false, unread: false }), true);
  assert.equal(shouldShowRenderedMessage({ unreadOnly: false, unread: true }), true);
  assert.equal(shouldShowRenderedMessage({ unreadOnly: true, unread: true }), true);
  assert.equal(shouldShowRenderedMessage({ unreadOnly: true, unread: false }), false);
  assert.equal(shouldShowRenderedMessage({ unreadOnly: true, unread: undefined }), false);
});

test('unread filter status describes only the current loaded view', () => {
  assert.equal(
    unreadFilterStatus({ unreadOnly: false, visibleCount: 8 }),
    'Showing the current loaded mailbox view.',
  );
  assert.equal(
    unreadFilterStatus({ unreadOnly: true, visibleCount: 1 }),
    'Showing 1 unread message from the current loaded mailbox view.',
  );
  assert.equal(
    unreadFilterStatus({ unreadOnly: true, visibleCount: 3 }),
    'Showing 3 unread messages from the current loaded mailbox view.',
  );
});
