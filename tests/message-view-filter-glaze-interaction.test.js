import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../web/unread-filter.css', import.meta.url), 'utf8');

test('loaded message view filter keeps the Glaze UI 2.1 general interaction floor', () => {
  assert.match(css, /\.mailbox-view-filter\s*\{[^}]*min-height:\s*48px;/s);
  assert.match(css, /\.mailbox-view-filter select\s*\{[^}]*min-height:\s*48px;/s);
});
