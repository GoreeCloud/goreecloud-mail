import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), 'utf8');
}

test('message reader consumes the Wardveil attachment presentation gate', async () => {
  const app = await source('web/app.js');
  assert.match(app, /presentAttachmentSecurity\(attachment\.securityDecision\)/);
  assert.match(app, /button\.disabled = !allowed/);
  assert.match(app, /readerAttachmentStatus/);
  assert.match(app, /transport is not connected in the development shell/);
  assert.doesNotMatch(app, /innerHTML\s*=/);
});

test('reader exposes an accessible attachment region and dedicated security styles', async () => {
  const [html, css] = await Promise.all([
    source('web/index.html'),
    source('web/attachment-security.css'),
  ]);
  assert.match(html, /id="readerAttachments"[^>]+aria-label="Attachments"/);
  assert.match(html, /id="readerAttachmentStatus"[^>]+role="status"/);
  assert.match(html, /attachment-security\.css/);
  assert.match(css, /\.attachment-actions button:disabled/);
});

test('demo provider exercises both allowed and held attachment states', async () => {
  const provider = await source('web/providers/demo-provider.js');
  assert.match(provider, /wardveil_scan_clean_current/);
  assert.match(provider, /disposition: 'hold_review'/);
  assert.match(provider, /can_open: false/);
  assert.match(provider, /can_download: false/);
});
