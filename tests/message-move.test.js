import assert from 'node:assert/strict';
import test from 'node:test';

import { moveDestinationMailboxes } from '../web/message-move.js';

const mailboxes = [
  { id: 'inbox', name: 'Inbox' },
  { id: 'starred', name: 'Starred' },
  { id: 'sent', name: 'Sent' },
  { id: 'drafts', name: 'Drafts' },
  { id: 'archive', name: 'Archive' },
  { id: 'trash', name: 'Trash' },
  { id: 'projects', name: 'Projects' },
];

test('move destinations omit the current and non-folder action mailboxes', () => {
  assert.deepEqual(moveDestinationMailboxes(mailboxes, 'inbox'), [
    { id: 'archive', name: 'Archive' },
    { id: 'projects', name: 'Projects' },
  ]);
});

test('archive view can move back to Inbox or a provider folder', () => {
  assert.deepEqual(moveDestinationMailboxes(mailboxes, 'archive'), [
    { id: 'inbox', name: 'Inbox' },
    { id: 'projects', name: 'Projects' },
  ]);
});

test('malformed and duplicate mailbox rows are ignored', () => {
  assert.deepEqual(moveDestinationMailboxes([
    { id: 'inbox', name: 'Inbox' },
    { id: 'inbox', name: 'Inbox duplicate' },
    { id: '', name: 'Missing id' },
    { id: 'custom', name: '' },
    null,
  ], 'archive'), [{ id: 'inbox', name: 'Inbox' }]);
});
