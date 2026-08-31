import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appUrl = new URL('../web/app.js', import.meta.url);

async function appSource() {
  return readFile(appUrl, 'utf8');
}

test('reader wiring uses the capability-gated read-state contract and provider mutation', async () => {
  const source = await appSource();

  assert.match(source, /deriveReadStateAction/);
  assert.match(source, /canExposeReadStateAction/);
  assert.match(source, /MAIL_PROVIDER_CAPABILITY\.READ_STATE/);
  assert.match(source, /provider\.setReadState\(messageId, action\.targetRead\)/);
  assert.match(source, /await loadMailbox\(selectedMailboxId, \{ force: true \}\)/);
  assert.match(source, /await openMessage\(messageId\)/);
});

test('opening a message does not implicitly mutate provider read state', async () => {
  const source = await appSource();
  const openMessageStart = source.indexOf('async function openMessage(id)');
  const loadMailboxStart = source.indexOf('async function loadMailbox', openMessageStart);
  assert.ok(openMessageStart >= 0 && loadMailboxStart > openMessageStart);

  const openMessageSource = source.slice(openMessageStart, loadMailboxStart);
  assert.doesNotMatch(openMessageSource, /setReadState/);
});
