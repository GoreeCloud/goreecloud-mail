import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, rename, rm } from 'node:fs/promises';
import path from 'node:path';

import { classifyAttachment } from './attachment-policy.js';
import { DEFAULT_ATTACHMENT_LIMITS, sniffMimeType } from './attachment-content-policy.js';

const DEFAULT_SAMPLE_BYTES = 64 * 1024;

export class AttachmentTooLargeError extends Error {
  constructor(limitBytes) {
    super(`Attachment exceeds the ${limitBytes}-byte storage limit.`);
    this.name = 'AttachmentTooLargeError';
    this.code = 'attachment-too-large';
    this.limitBytes = limitBytes;
  }
}

/**
 * Stores attachment bytes without trusting the sender-provided filename as a
 * filesystem path and without buffering the entire attachment in memory.
 *
 * The returned record contains only bounded metadata. Callers remain
 * responsible for user/account authorization before invoking this layer and
 * for applying attachment response/preview policy before delivery.
 */
export async function storeAttachmentStream({
  rootDir,
  metadata = {},
  source,
  maxBytes = DEFAULT_ATTACHMENT_LIMITS.downloadBytes,
  sampleBytes = DEFAULT_SAMPLE_BYTES,
  idFactory = randomUUID,
} = {}) {
  if (!rootDir) throw new TypeError('rootDir is required');
  if (!source || typeof source[Symbol.asyncIterator] !== 'function') {
    throw new TypeError('source must be an AsyncIterable of Buffer or Uint8Array chunks');
  }
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new TypeError('maxBytes must be a positive safe integer');
  if (!Number.isSafeInteger(sampleBytes) || sampleBytes <= 0) throw new TypeError('sampleBytes must be a positive safe integer');

  const attachment = classifyAttachment(metadata);
  const objectId = String(idFactory());
  if (!/^[A-Za-z0-9._-]+$/.test(objectId)) throw new TypeError('generated attachment object id is unsafe');

  await mkdir(rootDir, { recursive: true, mode: 0o700 });
  const finalPath = path.join(rootDir, objectId);
  const temporaryPath = path.join(rootDir, `.${objectId}.partial`);
  const handle = await open(temporaryPath, 'wx', 0o600);
  const digest = createHash('sha256');
  const samples = [];
  let sampled = 0;
  let actualSize = 0;

  try {
    for await (const chunk of source) {
      const buffer = asBuffer(chunk);
      actualSize += buffer.byteLength;
      if (actualSize > maxBytes) throw new AttachmentTooLargeError(maxBytes);

      digest.update(buffer);
      if (sampled < sampleBytes) {
        const remaining = sampleBytes - sampled;
        const portion = buffer.subarray(0, remaining);
        samples.push(portion);
        sampled += portion.byteLength;
      }
      await handle.write(buffer);
    }

    await handle.sync();
    await handle.close();
    await rename(temporaryPath, finalPath);
  } catch (error) {
    await handle.close().catch(() => {});
    await rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }

  const sample = Buffer.concat(samples, sampled);
  const sniffedMimeType = sniffMimeType(sample);
  const sizeMismatch = attachment.size !== null && attachment.size !== actualSize;

  return Object.freeze({
    objectId,
    path: finalPath,
    actualSize,
    declaredSize: attachment.size,
    sizeMismatch,
    declaredMimeType: attachment.mimeType,
    sniffedMimeType,
    sha256: digest.digest('hex'),
    executableDeclared: attachment.executable,
  });
}

export async function removeStoredAttachment({ rootDir, objectId } = {}) {
  if (!rootDir) throw new TypeError('rootDir is required');
  if (!/^[A-Za-z0-9._-]+$/.test(String(objectId ?? ''))) throw new TypeError('objectId is invalid');
  await rm(path.join(rootDir, String(objectId)), { force: true });
}

function asBuffer(chunk) {
  if (Buffer.isBuffer(chunk)) return chunk;
  if (chunk instanceof Uint8Array) return Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
  throw new TypeError('attachment stream chunks must be Buffer or Uint8Array values');
}
