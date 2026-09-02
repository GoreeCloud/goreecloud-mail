import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../web/unread-filter.css', import.meta.url), 'utf8');

test('loaded message view filter keeps the Glaze UI 2.1 general interaction floor', () => {
  assert.match(css, /\.mailbox-view-filter\s*\{[^}]*min-height:\s*48px;/s);
  assert.match(css, /\.mailbox-view-filter select\s*\{[^}]*min-height:\s*48px;/s);
});

test('loaded message view filter remains explicit in forced colors', () => {
  assert.match(css, /@media \(forced-colors:\s*active\)\s*\{/);
  assert.match(css, /\.mailbox-view-filter\s*\{[^}]*background:\s*Canvas;[^}]*color:\s*CanvasText;[^}]*border-color:\s*CanvasText;/s);
  assert.match(css, /\.mailbox-view-filter:focus-within\s*\{[^}]*border-color:\s*Highlight;[^}]*box-shadow:\s*0 0 0 2px Highlight;/s);
});
