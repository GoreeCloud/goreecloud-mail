import assert from 'node:assert/strict';
import test from 'node:test';

import { filterLoadedMailboxMessages, mailboxName } from '../web/mailbox-view.js';

const messages = [
  {
    id: 'one',
    sender: 'GoreeCloud Mail',
    address: 'mail@goreecloud.local',
    subject: 'Welcome',
    preview: 'Private mailbox shell',
    body: 'First message',
    unread: true,
  },
  {
    id: 'two',
    sender: 'Wardveil Security',
    address: 'wardveil@goreecloud.local',
    subject: 'Security notice',
    preview: 'Attachment protected',
    body: 'Second message',
    unread: false,
  },
  {
    id: 'three',
    sender: 'Wardveil Security',
    address: 'alerts@goreecloud.local',
    subject: 'Unread security notice',
    preview: 'Review locally',
    body: 'Third message',
    unread: true,
  },
];

test('mailbox search stays inside the already loaded mailbox snapshot', () => {
  assert.deepEqual(filterLoadedMailboxMessages(messages, 'security').map(({ id }) => id), ['two', 'three']);
  assert.deepEqual(filterLoadedMailboxMessages(messages, 'MAIL@GOREECLOUD').map(({ id }) => id), ['one']);
  assert.deepEqual(filterLoadedMailboxMessages(messages, ''), messages);
});

test('unread presentation filter composes with local search without inventing provider state', () => {
  assert.deepEqual(
    filterLoadedMailboxMessages(messages, '', { unreadOnly: true }).map(({ id }) => id),
    ['one', 'three'],
  );
  assert.deepEqual(
    filterLoadedMailboxMessages(messages, 'security', { unreadOnly: true }).map(({ id }) => id),
    ['three'],
  );
});

test('mailbox presentation filtering fails closed for malformed message collections', () => {
  assert.deepEqual(filterLoadedMailboxMessages(null, 'security'), []);
  assert.deepEqual(filterLoadedMailboxMessages(null, '', { unreadOnly: true }), []);
});

test('mailbox labels resolve only from the provider mailbox snapshot', () => {
  const mailboxes = [
    { id: 'inbox', name: 'Inbox' },
    { id: 'starred', name: 'Starred' },
  ];
  assert.equal(mailboxName(mailboxes, 'starred'), 'Starred');
  assert.equal(mailboxName(mailboxes, 'missing'), 'Mailbox');
});
