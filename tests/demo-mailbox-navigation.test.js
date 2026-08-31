import assert from 'node:assert/strict';
import test from 'node:test';

import { DemoMailProvider } from '../web/providers/demo-provider.js';

test('demo provider exposes distinct inbox and starred mailbox snapshots', async () => {
  const provider = new DemoMailProvider();
  const inbox = await provider.listMessages('inbox');
  const starred = await provider.listMessages('starred');

  assert.equal(inbox.length, 2);
  assert.deepEqual(starred.map(({ id }) => id), ['security-1']);
  assert.deepEqual(await provider.listMessages('sent'), []);
});

test('demo flag mutation changes the subsequent starred provider snapshot', async () => {
  const provider = new DemoMailProvider();
  await provider.flag('welcome-1', true);
  assert.deepEqual(
    (await provider.listMessages('starred')).map(({ id }) => id).sort(),
    ['security-1', 'welcome-1'],
  );
  await provider.flag('welcome-1', false);
});
