import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAttachmentResponseHeaders,
  inspectAttachmentBytes,
  sniffMimeType,
} from '../server/attachment-content-policy.js';

test('sniffs common previewable formats from bytes', () => {
  assert.equal(sniffMimeType(Buffer.from('%PDF-1.7\n')), 'application/pdf');
  assert.equal(sniffMimeType(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])), 'image/png');
  assert.equal(sniffMimeType(Buffer.from([0xff,0xd8,0xff,0xe0])), 'image/jpeg');
});

test('executable bytes override an innocent declared type', () => {
  const result = inspectAttachmentBytes(
    { filename: 'invoice.pdf', mimeType: 'application/pdf' },
    Buffer.from('MZ-not-a-pdf'),
  );
  assert.equal(result.executableBytes, true);
  assert.equal(result.mimeMismatch, true);
  assert.equal(result.previewAllowed, false);
  assert.equal(result.risk, 'high');
});

test('size mismatches are surfaced without silently trusting metadata', () => {
  const result = inspectAttachmentBytes(
    { filename: 'note.txt', mimeType: 'text/plain', size: 999 },
    Buffer.from('hello'),
  );
  assert.equal(result.actualSize, 5);
  assert.equal(result.sizeMismatch, true);
  assert.equal(result.risk, 'caution');
});

test('preview and download size ceilings are independent', () => {
  const bytes = Buffer.alloc(12);
  const result = inspectAttachmentBytes(
    { filename: 'image.png', mimeType: 'image/png' },
    bytes,
    { limits: { inlineBytes: 4, previewBytes: 8, downloadBytes: 16 } },
  );
  assert.equal(result.tooLargeForInline, true);
  assert.equal(result.tooLargeForPreview, true);
  assert.equal(result.tooLargeForDownload, false);
  assert.equal(result.previewAllowed, false);
  assert.equal(result.downloadAllowed, true);
});

test('unsafe downloads are forced to attachment and nosniff', () => {
  const inspection = inspectAttachmentBytes(
    { filename: '../payload.exe', mimeType: 'application/pdf' },
    Buffer.from('MZpayload'),
  );
  const headers = buildAttachmentResponseHeaders({}, inspection);
  assert.equal(headers['Content-Type'], 'application/octet-stream');
  assert.match(headers['Content-Disposition'], /^attachment;/);
  assert.doesNotMatch(headers['Content-Disposition'], /\.\.\//);
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['Cache-Control'], 'private, no-store');
});
