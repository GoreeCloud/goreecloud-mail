import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MESSAGE_VIEW_FILTER,
  messageViewFilterStatus,
  normalizeMessageViewFilter,
  shouldShowLoadedMessage,
} from '../web/message-view-filter.js';

test('message view filters normalize unknown input to the loaded all view', () => {
  assert.equal(normalizeMessageViewFilter('FLAGGED'), MESSAGE_VIEW_FILTER.FLAGGED);
  assert.equal(normalizeMessageViewFilter(' read '), MESSAGE_VIEW_FILTER.READ);
  assert.equal(normalizeMessageViewFilter(' unread-flagged '), MESSAGE_VIEW_FILTER.UNREAD_FLAGGED);
  assert.equal(normalizeMessageViewFilter('remote-search'), MESSAGE_VIEW_FILTER.ALL);
  assert.equal(normalizeMessageViewFilter(undefined), MESSAGE_VIEW_FILTER.ALL);
});

test('loaded message filtering is a pure projection of provider-authoritative booleans', () => {
  assert.equal(shouldShowLoadedMessage({ filter: 'all', unread: false, flagged: false }), true);
  assert.equal(shouldShowLoadedMessage({ filter: 'unread', unread: true, flagged: false }), true);
  assert.equal(shouldShowLoadedMessage({ filter: 'unread', unread: undefined, flagged: true }), false);
  assert.equal(shouldShowLoadedMessage({ filter: 'read', unread: false, flagged: false }), true);
  assert.equal(shouldShowLoadedMessage({ filter: 'read', unread: true, flagged: true }), false);
  assert.equal(shouldShowLoadedMessage({ filter: 'read', unread: undefined, flagged: false }), false);
  assert.equal(shouldShowLoadedMessage({ filter: 'flagged', unread: false, flagged: true }), true);
  assert.equal(shouldShowLoadedMessage({ filter: 'flagged', unread: true, flagged: undefined }), false);
  assert.equal(shouldShowLoadedMessage({ filter: 'unread-flagged', unread: true, flagged: true }), true);
  assert.equal(shouldShowLoadedMessage({ filter: 'unread-flagged', unread: true, flagged: false }), false);
});

test('filter status names only the current loaded mailbox view', () => {
  assert.equal(
    messageViewFilterStatus({ filter: 'all', visibleCount: 8 }),
    'Showing the current loaded mailbox view.',
  );
  assert.equal(
    messageViewFilterStatus({ filter: 'read', visibleCount: 2 }),
    'Showing 2 read messages from the current loaded mailbox view.',
  );
  assert.equal(
    messageViewFilterStatus({ filter: 'flagged', visibleCount: 1 }),
    'Showing 1 flagged message from the current loaded mailbox view.',
  );
  assert.equal(
    messageViewFilterStatus({ filter: 'unread-flagged', visibleCount: 3 }),
    'Showing 3 unread flagged messages from the current loaded mailbox view.',
  );
});
