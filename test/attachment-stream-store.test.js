import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  AttachmentTooLargeError,
  removeStoredAttachment,
  storeAttachmentStream,
} from '../server/attachment-stream-store.js';

async function* chunks(...values) {
  for (const value of values) yield Buffer.from(value);
}

test('streamed storage uses an opaque object id rather than the sender filename', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'goreecloud-mail-attachments-'));
  const result = await storeAttachmentStream({
    rootDir,
    metadata: { filename: '../../quarterly.pdf', mimeType: 'application/pdf', size: 8 },
    source: chunks('%PDF-', 'abc'),
    idFactory: () => 'object-01',
  });

  assert.equal(path.basename(result.path), 'object-01');
  assert.equal(result.actualSize, 8);
  assert.equal(result.sizeMismatch, false);
  assert.equal(result.sniffedMimeType, 'application/pdf');
  assert.match(result.sha256, /^[a-f0-9]{64}$/);
  assert.equal((await stat(result.path)).mode & 0o777, 0o600);
  assert.equal((await readFile(result.path)).toString(), '%PDF-abc');
});

test('streamed storage enforces a hard byte ceiling and removes partial files', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'goreecloud-mail-attachments-'));

  await assert.rejects(
    storeAttachmentStream({
      rootDir,
      metadata: { filename: 'large.bin' },
      source: chunks('1234', '5678'),
      maxBytes: 7,
      idFactory: () => 'too-large',
    }),
    (error) => error instanceof AttachmentTooLargeError && error.limitBytes === 7,
  );

  await assert.rejects(stat(path.join(rootDir, 'too-large')), /ENOENT/);
  await assert.rejects(stat(path.join(rootDir, '.too-large.partial')), /ENOENT/);
});

test('streamed storage detects declared size mismatch without trusting it', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'goreecloud-mail-attachments-'));
  const result = await storeAttachmentStream({
    rootDir,
    metadata: { filename: 'image.png', mimeType: 'image/png', size: 999 },
    source: chunks(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'payload'),
    idFactory: () => 'object-02',
  });

  assert.equal(result.sizeMismatch, true);
  assert.equal(result.sniffedMimeType, 'image/png');
});

test('stored attachments can be explicitly removed by validated opaque id', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'goreecloud-mail-attachments-'));
  const result = await storeAttachmentStream({
    rootDir,
    metadata: { filename: 'note.txt', mimeType: 'text/plain' },
    source: chunks('hello'),
    idFactory: () => 'object-03',
  });

  await removeStoredAttachment({ rootDir, objectId: result.objectId });
  await assert.rejects(stat(result.path), /ENOENT/);
  await assert.rejects(removeStoredAttachment({ rootDir, objectId: '../escape' }), /objectId is invalid/);
});
