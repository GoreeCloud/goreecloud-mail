import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const controlUrl = new URL('../web/unread-filter-control.js', import.meta.url);

async function controlSource() {
  return readFile(controlUrl, 'utf8');
}

test('rendered unread-only control observes cards without gaining provider authority', async () => {
  const source = await controlSource();
  assert.match(source, /querySelectorAll\('\[data-message-id\]'\)/);
  assert.match(source, /classList\.contains\('unread'\)/);
  assert.match(source, /MutationObserver/);
  assert.doesNotMatch(source, /provider\./);
  assert.doesNotMatch(source, /listMessages/);
  assert.doesNotMatch(source, /setReadState/);
  assert.doesNotMatch(source, /fetch\(/);
  assert.doesNotMatch(source, /XMLHttpRequest/);
});
