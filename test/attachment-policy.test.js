import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyAttachment,
  resolveCidReference,
  sanitizeDownloadFilename,
} from '../server/attachment-policy.js';

test('safe previewable attachments are classified conservatively', () => {
  assert.deepEqual(classifyAttachment({ filename: 'photo.png', mimeType: 'image/png', size: 42 }), {
    filename: 'photo.png',
    mimeType: 'image/png',
    size: 42,
    contentId: null,
    inline: false,
    executable: false,
    previewable: true,
    requiresExplicitDownload: false,
    risk: 'normal',
  });
});

test('executable extensions override misleading MIME types', () => {
  const result = classifyAttachment({ filename: 'invoice.pdf.exe', mimeType: 'application/pdf' });
  assert.equal(result.executable, true);
  assert.equal(result.previewable, false);
  assert.equal(result.requiresExplicitDownload, true);
  assert.equal(result.risk, 'high');
});

test('unknown content types require deliberate download instead of inline preview', () => {
  const result = classifyAttachment({ filename: 'archive.bin', mimeType: 'application/octet-stream' });
  assert.equal(result.executable, false);
  assert.equal(result.previewable, false);
  assert.equal(result.requiresExplicitDownload, true);
  assert.equal(result.risk, 'caution');
});

test('CID references resolve only to inert matching attachments', () => {
  const attachments = [
    { filename: 'logo.png', mimeType: 'image/png', contentId: '<logo@example>' },
    { filename: 'payload.exe', mimeType: 'application/octet-stream', contentId: '<bad@example>' },
  ];

  const logo = resolveCidReference('cid:logo@example', attachments);
  assert.equal(logo.filename, 'logo.png');
  assert.equal(resolveCidReference('cid:bad@example', attachments), null);
  assert.equal(resolveCidReference('https://example.com/logo.png', attachments), null);
});

test('download filenames discard paths and reserved control characters', () => {
  assert.equal(sanitizeDownloadFilename('../../etc/passwd'), 'passwd');
  assert.equal(sanitizeDownloadFilename('report\u0000?.pdf'), 'report__.pdf');
});
