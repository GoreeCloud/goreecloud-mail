import { classifyAttachment, sanitizeDownloadFilename } from './attachment-policy.js';

export const DEFAULT_ATTACHMENT_LIMITS = Object.freeze({
  downloadBytes: 50 * 1024 * 1024,
  previewBytes: 10 * 1024 * 1024,
  inlineBytes: 5 * 1024 * 1024,
});

const SIGNATURES = Object.freeze([
  { mime: 'application/pdf', test: (b) => startsWithAscii(b, '%PDF-') },
  { mime: 'image/png', test: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  { mime: 'image/jpeg', test: (b) => startsWith(b, [0xff, 0xd8, 0xff]) },
  { mime: 'image/gif', test: (b) => startsWithAscii(b, 'GIF87a') || startsWithAscii(b, 'GIF89a') },
  { mime: 'application/zip', test: (b) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]) || startsWith(b, [0x50, 0x4b, 0x05, 0x06]) },
  { mime: 'application/x-dosexec', test: (b) => startsWithAscii(b, 'MZ') },
  { mime: 'application/x-elf', test: (b) => startsWith(b, [0x7f, 0x45, 0x4c, 0x46]) },
]);

const TYPE_FAMILIES = Object.freeze({
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/gif': 'gif',
  'application/zip': 'archive',
  'application/x-dosexec': 'executable',
  'application/x-elf': 'executable',
});

export function inspectAttachmentBytes(metadata = {}, bytes, { limits = DEFAULT_ATTACHMENT_LIMITS } = {}) {
  const attachment = classifyAttachment(metadata);
  const buffer = asBuffer(bytes);
  const actualSize = buffer.byteLength;
  const declaredSize = attachment.size;
  const sniffedMimeType = sniffMimeType(buffer);
  const declaredFamily = TYPE_FAMILIES[attachment.mimeType] ?? null;
  const sniffedFamily = TYPE_FAMILIES[sniffedMimeType] ?? null;
  const executableBytes = sniffedFamily === 'executable';
  const mimeMismatch = Boolean(declaredFamily && sniffedFamily && declaredFamily !== sniffedFamily);
  const sizeMismatch = declaredSize !== null && declaredSize !== actualSize;
  const tooLargeForDownload = actualSize > limits.downloadBytes;
  const tooLargeForPreview = actualSize > limits.previewBytes;
  const tooLargeForInline = actualSize > limits.inlineBytes;

  const previewAllowed = attachment.previewable
    && !attachment.executable
    && !executableBytes
    && !mimeMismatch
    && !tooLargeForPreview;

  return Object.freeze({
    attachment,
    actualSize,
    declaredSize,
    sizeMismatch,
    sniffedMimeType,
    mimeMismatch,
    executableBytes,
    tooLargeForDownload,
    tooLargeForPreview,
    tooLargeForInline,
    previewAllowed,
    downloadAllowed: !tooLargeForDownload,
    risk: executableBytes || attachment.executable
      ? 'high'
      : mimeMismatch || sizeMismatch || tooLargeForPreview
        ? 'caution'
        : attachment.risk,
  });
}

export function sniffMimeType(bytes) {
  const buffer = asBuffer(bytes);
  return SIGNATURES.find(({ test }) => test(buffer))?.mime ?? 'application/octet-stream';
}

export function buildAttachmentResponseHeaders(metadata = {}, inspection = null) {
  const attachment = inspection?.attachment ?? classifyAttachment(metadata);
  const filename = sanitizeDownloadFilename(attachment.filename);
  const forceAttachment = !inspection?.previewAllowed;
  const disposition = forceAttachment ? 'attachment' : 'inline';

  return Object.freeze({
    'Content-Type': forceAttachment ? 'application/octet-stream' : attachment.mimeType,
    'Content-Disposition': `${disposition}; filename="${escapeHeaderFilename(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'Cache-Control': 'private, no-store',
  });
}

function asBuffer(bytes) {
  if (Buffer.isBuffer(bytes)) return bytes;
  if (bytes instanceof Uint8Array) return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  throw new TypeError('attachment bytes must be a Buffer or Uint8Array');
}

function startsWith(buffer, signature) {
  if (buffer.length < signature.length) return false;
  return signature.every((value, index) => buffer[index] === value);
}

function startsWithAscii(buffer, value) {
  return startsWith(buffer, [...Buffer.from(value, 'ascii')]);
}

function escapeHeaderFilename(value) {
  return value.replaceAll('\\', '_').replaceAll('"', '_').replace(/[\r\n]/g, '_');
}
