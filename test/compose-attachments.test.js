import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COMPOSE_ATTACHMENT_LIMITS,
  ComposeAttachmentError,
  materializeComposeAttachments,
} from '../web/compose-attachments.js';

function fileLike({ name = 'example.bin', type = 'application/octet-stream', bytes = Uint8Array.of(0, 1, 2, 255), size } = {}) {
  const snapshot = Uint8Array.from(bytes);
  return {
    name,
    type,
    size: size ?? snapshot.byteLength,
    async arrayBuffer() {
      return snapshot.buffer.slice(snapshot.byteOffset, snapshot.byteOffset + snapshot.byteLength);
    },
  };
}

test('materializes exact bytes as the server-compatible base64 attachment contract', async () => {
  const bytes = Uint8Array.of(0, 1, 2, 3, 127, 128, 254, 255);
  const result = await materializeComposeAttachments([
    fileLike({ name: 'Report.PDF', type: 'Application/PDF', bytes }),
  ]);

  assert.deepEqual(result, [{
    filename: 'Report.PDF',
    contentType: 'application/pdf',
    contentBase64: Buffer.from(bytes).toString('base64'),
  }]);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result[0]), true);
});

test('uses application/octet-stream when the browser provides no MIME type', async () => {
  const [attachment] = await materializeComposeAttachments([
    fileLike({ name: 'opaque.data', type: '' }),
  ]);
  assert.equal(attachment.contentType, 'application/octet-stream');
});

test('rejects unsafe filenames before reading bytes', async () => {
  let reads = 0;
  const bad = fileLike({ name: '../secret.txt' });
  bad.arrayBuffer = async () => {
    reads += 1;
    return new ArrayBuffer(0);
  };

  await assert.rejects(
    () => materializeComposeAttachments([bad]),
    (error) => error instanceof ComposeAttachmentError && /filename is unsafe/.test(error.message),
  );
  assert.equal(reads, 0);
});

test('rejects a file whose declared size changes while being read', async () => {
  await assert.rejects(
    () => materializeComposeAttachments([
      fileLike({ bytes: Uint8Array.of(1, 2, 3), size: 2 }),
    ]),
    (error) => error instanceof ComposeAttachmentError && error.code === 'attachment-size-mismatch',
  );
});

test('rejects per-file and total attachment limits', async () => {
  const tooLarge = {
    name: 'large.bin',
    type: 'application/octet-stream',
    size: COMPOSE_ATTACHMENT_LIMITS.perFileBytes + 1,
    async arrayBuffer() {
      throw new Error('should not read oversized declared file');
    },
  };
  await assert.rejects(
    () => materializeComposeAttachments([tooLarge]),
    (error) => error instanceof ComposeAttachmentError && error.code === 'attachment-file-size-limit',
  );

  const half = Math.floor(COMPOSE_ATTACHMENT_LIMITS.totalBytes / 2) + 1;
  const bytes = new Uint8Array(half);
  await assert.rejects(
    () => materializeComposeAttachments([
      fileLike({ name: 'a.bin', bytes }),
      fileLike({ name: 'b.bin', bytes }),
    ]),
    (error) => error instanceof ComposeAttachmentError && error.code === 'attachment-total-size-limit',
  );
});

test('rejects more files than the server-aligned count limit without reading them', async () => {
  let reads = 0;
  const files = Array.from({ length: COMPOSE_ATTACHMENT_LIMITS.count + 1 }, (_, index) => ({
    name: `${index}.bin`,
    type: 'application/octet-stream',
    size: 1,
    async arrayBuffer() {
      reads += 1;
      return Uint8Array.of(index & 0xff).buffer;
    },
  }));

  await assert.rejects(
    () => materializeComposeAttachments(files),
    (error) => error instanceof ComposeAttachmentError && error.code === 'attachment-count-limit',
  );
  assert.equal(reads, 0);
});
