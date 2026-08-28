import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyArchiveAttachment, validateArchiveManifest } from '../server/archive-content-policy.js';

test('zip archives remain download-only and never auto-extract', () => {
  const result = classifyArchiveAttachment({ filename: 'records.zip', mimeType: 'application/zip' });
  assert.equal(result.archive, true);
  assert.equal(result.format, 'zip');
  assert.equal(result.automaticExtractionAllowed, false);
  assert.equal(result.previewAllowed, false);
  assert.equal(result.downloadAllowed, true);
});

test('unknown archive-like content is not promoted to a supported archive format', () => {
  const result = classifyArchiveAttachment({ filename: 'records.7z', mimeType: 'application/x-7z-compressed' });
  assert.equal(result.archive, false);
  assert.equal(result.format, null);
  assert.equal(result.automaticExtractionAllowed, false);
});

test('archive manifests preserve bounded safe relative members', () => {
  const result = validateArchiveManifest([
    { name: 'docs/report.pdf', size: 1024 },
    { name: 'photos/image.jpg', size: 2048 },
  ]);
  assert.equal(result.memberCount, 2);
  assert.equal(result.expandedBytes, 3072);
  assert.equal(result.members[0].name, 'docs/report.pdf');
});

test('archive manifests reject traversal and absolute paths', () => {
  assert.throws(() => validateArchiveManifest([{ name: '../secret.txt', size: 1 }]), /escapes the extraction root/);
  assert.throws(() => validateArchiveManifest([{ name: '/etc/passwd', size: 1 }]), /absolute path/);
  assert.throws(() => validateArchiveManifest([{ name: 'C:/Windows/system.ini', size: 1 }]), /absolute path/);
  assert.throws(() => validateArchiveManifest([{ name: 'folder\\evil.txt', size: 1 }]), /unsupported path separator/);
});

test('archive manifests enforce member and expanded byte ceilings', () => {
  assert.throws(
    () => validateArchiveManifest([{ name: 'large.bin', size: 11 }], { maxMembers: 10, maxMemberBytes: 10, maxExpandedBytes: 100 }),
    /member byte limit/,
  );
  assert.throws(
    () => validateArchiveManifest(
      [{ name: 'a.bin', size: 6 }, { name: 'b.bin', size: 6 }],
      { maxMembers: 10, maxMemberBytes: 10, maxExpandedBytes: 10 },
    ),
    /expanded byte limit/,
  );
  assert.throws(
    () => validateArchiveManifest(
      [{ name: 'a', size: 1 }, { name: 'b', size: 1 }],
      { maxMembers: 1, maxMemberBytes: 10, maxExpandedBytes: 10 },
    ),
    /member limit/,
  );
});
