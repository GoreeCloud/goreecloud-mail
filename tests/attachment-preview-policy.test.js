import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyAttachmentPreview } from '../server/attachment-preview-policy.js';

test('images require controlled metadata-safe previews', () => {
  const result = classifyAttachmentPreview({ filename: 'photo.jpg', mimeType: 'image/jpeg' });
  assert.equal(result.preview, 'image-preview');
  assert.equal(result.externalRequestsAllowed, false);
});

test('pdf previews require sandboxing', () => {
  const result = classifyAttachmentPreview({ filename: 'document.pdf', mimeType: 'application/pdf' });
  assert.equal(result.preview, 'pdf-preview');
  assert.equal(result.sandboxRequired, true);
});

test('executable attachments cannot be previewed', () => {
  const result = classifyAttachmentPreview({ filename: 'installer.exe', mimeType: 'application/octet-stream' });
  assert.equal(result.preview, 'no-preview');
});
