import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../web/unread-filter.css', import.meta.url), 'utf8');

test('loaded message view filter keeps the Glaze UI 2.2 interaction floors', () => {
  assert.match(css, /:root\s*\{[^}]*--mailbox-view-filter-target:\s*48px;/s);
  assert.match(css, /html\[data-glaze-touch-assistance="true"\]\s*\{[^}]*--mailbox-view-filter-target:\s*56px;/s);
  assert.match(css, /\.mailbox-view-filter\s*\{[^}]*min-height:\s*var\(--mailbox-view-filter-target\);/s);
  assert.match(css, /\.mailbox-view-filter select\s*\{[^}]*min-height:\s*var\(--mailbox-view-filter-target\);/s);
  assert.doesNotMatch(css, /pointer:\s*coarse/);
});

test('loaded message view filter has bounded narrow-width and zoom reflow rules', () => {
  assert.match(css, /\.mailbox-view-controls\s*\{[^}]*flex-wrap:\s*wrap;/s);
  assert.match(css, /\.mailbox-view-controls \.search-field\s*\{[^}]*min-width:\s*0;/s);
  assert.match(css, /\.mailbox-view-filter\s*\{[^}]*min-width:\s*0;[^}]*max-width:\s*100%;[^}]*flex:\s*0 1 auto;/s);
  assert.match(css, /\.mailbox-view-filter select\s*\{[^}]*min-width:\s*0;[^}]*max-width:\s*100%;[^}]*flex:\s*1 1 auto;/s);
  assert.doesNotMatch(css, /max-width:\s*168px/);

  assert.match(css, /@media \(max-width:\s*720px\)\s*\{[\s\S]*?\.mailbox-view-controls\s*\{[^}]*width:\s*100%;[^}]*align-items:\s*stretch;[^}]*flex-direction:\s*column;/s);
  assert.match(css, /@media \(max-width:\s*720px\)\s*\{[\s\S]*?\.mailbox-view-controls \.search-field,\s*\.mailbox-view-filter\s*\{[^}]*width:\s*100%;/s);
  assert.match(css, /@media \(max-width:\s*360px\)\s*\{[\s\S]*?\.mailbox-view-filter\s*\{[^}]*align-items:\s*stretch;[^}]*flex-direction:\s*column;/s);
  assert.match(css, /@media \(max-width:\s*360px\)\s*\{[\s\S]*?\.mailbox-view-filter select\s*\{[^}]*width:\s*100%;/s);
});

test('loaded message view filter provides reduced-transparency and increased-contrast fallbacks', () => {
  assert.match(css, /@media \(prefers-reduced-transparency:\s*reduce\)\s*\{/);
  assert.match(css, /\.mailbox-view-filter\s*\{[^}]*background:\s*#ffffff;/s);
  assert.match(css, /@media \(prefers-color-scheme:\s*dark\) and \(prefers-reduced-transparency:\s*reduce\)\s*\{/);
  assert.match(css, /\.mailbox-view-filter\s*\{[^}]*background:\s*#161e2b;/s);
  assert.match(css, /@media \(prefers-contrast:\s*more\)\s*\{/);
  assert.match(css, /\.mailbox-view-filter\s*\{[^}]*border-width:\s*2px;[^}]*border-color:\s*currentColor;/s);
});

test('loaded message view filter remains explicit in forced colors', () => {
  assert.match(css, /@media \(forced-colors:\s*active\)\s*\{/);
  assert.match(css, /\.mailbox-view-filter\s*\{[^}]*background:\s*Canvas;[^}]*color:\s*CanvasText;[^}]*border-color:\s*CanvasText;/s);
  assert.match(css, /\.mailbox-view-filter:focus-within\s*\{[^}]*border-color:\s*Highlight;[^}]*box-shadow:\s*0 0 0 2px Highlight;/s);
});
