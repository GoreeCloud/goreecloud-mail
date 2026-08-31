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
  },
  {
    id: 'two',
    sender: 'Wardveil Security',
    address: 'wardveil@goreecloud.local',
    subject: 'Security notice',
    preview: 'Attachment protected',
    body: 'Second message',
  },
];

test('mailbox search stays inside the already loaded mailbox snapshot', () => {
  assert.deepEqual(filterLoadedMailboxMessages(messages, 'security').map(({ id }) => id), ['two']);
  assert.deepEqual(filterLoadedMailboxMessages(messages, 'MAIL@GOREECLOUD').map(({ id }) => id), ['one']);
  assert.deepEqual(filterLoadedMailboxMessages(messages, ''), messages);
});

test('mailbox search fails closed for malformed message collections', () => {
  assert.deepEqual(filterLoadedMailboxMessages(null, 'security'), []);
});

test('mailbox labels resolve only from the provider mailbox snapshot', () => {
  const mailboxes = [
    { id: 'inbox', name: 'Inbox' },
    { id: 'starred', name: 'Starred' },
  ];
  assert.equal(mailboxName(mailboxes, 'starred'), 'Starred');
  assert.equal(mailboxName(mailboxes, 'missing'), 'Mailbox');
});
