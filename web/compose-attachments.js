export const COMPOSE_ATTACHMENT_LIMITS = Object.freeze({
  count: 20,
  perFileBytes: 10 * 1024 * 1024,
  totalBytes: 20 * 1024 * 1024,
  filenameChars: 255,
  contentTypeChars: 255,
});

const SIMPLE_MEDIA_TYPE = /^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+$/;

export class ComposeAttachmentError extends Error {
  constructor(message, { code = 'invalid-attachment' } = {}) {
    super(message);
    this.name = 'ComposeAttachmentError';
    this.code = code;
  }
}

export async function materializeComposeAttachments(files) {
  const source = Array.from(files ?? []);
  if (source.length > COMPOSE_ATTACHMENT_LIMITS.count) {
    throw new ComposeAttachmentError('Too many attachments were selected.', { code: 'attachment-count-limit' });
  }

  const materialized = [];
  let totalBytes = 0;

  for (let index = 0; index < source.length; index += 1) {
    const file = source[index];
    validateFileLike(file, index);
    const filename = normalizeFilename(file.name, index);
    const contentType = normalizeContentType(file.type, index);

    const declaredSize = Number(file.size);
    if (Number.isFinite(declaredSize) && declaredSize > COMPOSE_ATTACHMENT_LIMITS.perFileBytes) {
      throw new ComposeAttachmentError(`Attachment ${index + 1} exceeds the per-file size limit.`, {
        code: 'attachment-file-size-limit',
      });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength > COMPOSE_ATTACHMENT_LIMITS.perFileBytes) {
      throw new ComposeAttachmentError(`Attachment ${index + 1} exceeds the per-file size limit.`, {
        code: 'attachment-file-size-limit',
      });
    }
    if (Number.isFinite(declaredSize) && declaredSize >= 0 && declaredSize !== bytes.byteLength) {
      throw new ComposeAttachmentError(`Attachment ${index + 1} changed while it was being read.`, {
        code: 'attachment-size-mismatch',
      });
    }

    totalBytes += bytes.byteLength;
    if (totalBytes > COMPOSE_ATTACHMENT_LIMITS.totalBytes) {
      throw new ComposeAttachmentError('Selected attachments exceed the total size limit.', {
        code: 'attachment-total-size-limit',
      });
    }

    materialized.push(Object.freeze({
      filename,
      contentType,
      contentBase64: bytesToBase64(bytes),
    }));
  }

  return Object.freeze(materialized);
}

function validateFileLike(file, index) {
  if (!file || typeof file !== 'object' || typeof file.arrayBuffer !== 'function') {
    throw new ComposeAttachmentError(`Attachment ${index + 1} is not readable.`, {
      code: 'attachment-unreadable',
    });
  }
}

function normalizeFilename(value, index) {
  if (typeof value !== 'string') {
    throw new ComposeAttachmentError(`Attachment ${index + 1} filename is invalid.`);
  }
  const filename = value.trim();
  if (!filename) throw new ComposeAttachmentError(`Attachment ${index + 1} filename is required.`);
  if (/[\r\n\0]/.test(filename) || /[\\/]/.test(filename)) {
    throw new ComposeAttachmentError(`Attachment ${index + 1} filename is unsafe.`);
  }
  if (filename.length > COMPOSE_ATTACHMENT_LIMITS.filenameChars) {
    throw new ComposeAttachmentError(`Attachment ${index + 1} filename exceeds the configured limit.`, {
      code: 'attachment-filename-limit',
    });
  }
  return filename;
}

function normalizeContentType(value, index) {
  if (value == null || value === '') return 'application/octet-stream';
  if (typeof value !== 'string') {
    throw new ComposeAttachmentError(`Attachment ${index + 1} content type is invalid.`);
  }
  const contentType = value.trim();
  if (contentType.length > COMPOSE_ATTACHMENT_LIMITS.contentTypeChars) {
    throw new ComposeAttachmentError(`Attachment ${index + 1} content type exceeds the configured limit.`, {
      code: 'attachment-content-type-limit',
    });
  }
  if (!SIMPLE_MEDIA_TYPE.test(contentType)) {
    throw new ComposeAttachmentError(`Attachment ${index + 1} content type must be a simple media type.`);
  }
  return contentType.toLowerCase();
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}
