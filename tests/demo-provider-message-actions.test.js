import assert from 'node:assert/strict';
import test from 'node:test';

import { DemoMailProvider } from '../web/providers/demo-provider.js';

test('demo archive moves a message out of Inbox and into Archive', async () => {
  const provider = new DemoMailProvider();

  assert.equal((await provider.listMessages('inbox')).length, 2);
  await provider.archive('welcome-1');

  assert.deepEqual((await provider.listMessages('inbox')).map(({ id }) => id), ['security-1']);
  assert.deepEqual((await provider.listMessages('archive')).map(({ id }) => id), ['welcome-1']);
  assert.equal((await provider.listMailboxes()).find(({ id }) => id === 'inbox').unread, 0);
});

test('demo delete moves a message into Trash and removes it from Starred', async () => {
  const provider = new DemoMailProvider();

  assert.deepEqual((await provider.listMessages('starred')).map(({ id }) => id), ['security-1']);
  await provider.remove('security-1');

  assert.deepEqual(await provider.listMessages('starred'), []);
  assert.deepEqual((await provider.listMessages('trash')).map(({ id }) => id), ['security-1']);
});

test('demo provider instances do not share mutation state', async () => {
  const first = new DemoMailProvider();
  const second = new DemoMailProvider();

  await first.archive('welcome-1');

  assert.equal((await first.listMessages('inbox')).length, 1);
  assert.equal((await second.listMessages('inbox')).length, 2);
});
