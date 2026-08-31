import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAIL_READ_STATE_ACTION,
  canExposeReadStateAction,
  deriveReadStateAction,
} from '../web/read-state-action.js';

test('unread message produces an explicit mark-read mutation target', () => {
  assert.deepEqual(deriveReadStateAction({ unread: true }), {
    available: true,
    action: MAIL_READ_STATE_ACTION.MARK_READ,
    targetRead: true,
    label: 'Mark read',
    successLabel: 'message marked read',
  });
});

test('read message produces an explicit mark-unread mutation target', () => {
  assert.deepEqual(deriveReadStateAction({ unread: false }), {
    available: true,
    action: MAIL_READ_STATE_ACTION.MARK_UNREAD,
    targetRead: false,
    label: 'Mark unread',
    successLabel: 'message marked unread',
  });
});

test('reader action is unavailable without a selected message', () => {
  assert.equal(deriveReadStateAction(null).available, false);
});

test('capability gate requires selection, provider support, and no mutation in flight', () => {
  assert.equal(canExposeReadStateAction({ hasSelection: true, mutationInFlight: false, readStateCapability: true }), true);
  assert.equal(canExposeReadStateAction({ hasSelection: false, mutationInFlight: false, readStateCapability: true }), false);
  assert.equal(canExposeReadStateAction({ hasSelection: true, mutationInFlight: true, readStateCapability: true }), false);
  assert.equal(canExposeReadStateAction({ hasSelection: true, mutationInFlight: false, readStateCapability: false }), false);
});
