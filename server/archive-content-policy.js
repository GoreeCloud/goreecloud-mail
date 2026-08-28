import path from 'node:path';

export const DEFAULT_ARCHIVE_LIMITS = Object.freeze({
  maxMembers: 512,
  maxExpandedBytes: 100 * 1024 * 1024,
  maxMemberBytes: 25 * 1024 * 1024,
});

const ARCHIVE_MIME_TYPES = new Set([
  'application/zip',
  'application/x-zip-compressed',
]);

/**
 * Fail-closed Courier Attachments archive policy.
 *
 * This module does not extract archives. It validates metadata and member manifests
 * supplied by a future trusted archive parser so extraction can remain bounded and
 * path-safe. Unknown or unsupported archive formats remain download-only.
 */
export function classifyArchiveAttachment({ filename = '', mimeType = '' } = {}) {
  const normalizedName = String(filename).trim().toLowerCase();
  const normalizedType = String(mimeType).trim().toLowerCase();
  const zip = normalizedName.endsWith('.zip') || ARCHIVE_MIME_TYPES.has(normalizedType);

  return Object.freeze({
    archive: zip,
    format: zip ? 'zip' : null,
    automaticExtractionAllowed: false,
    previewAllowed: false,
    downloadAllowed: true,
  });
}

export function validateArchiveManifest(members, limits = DEFAULT_ARCHIVE_LIMITS) {
  if (!Array.isArray(members)) throw new TypeError('members must be an array');
  const resolved = normalizeLimits(limits);
  if (members.length > resolved.maxMembers) throw new RangeError('archive member limit exceeded');

  let expandedBytes = 0;
  const normalized = members.map((member, index) => {
    const name = validateMemberName(member?.name, index);
    const size = Number(member?.size);
    if (!Number.isSafeInteger(size) || size < 0) throw new TypeError(`archive member ${index} size is invalid`);
    if (size > resolved.maxMemberBytes) throw new RangeError(`archive member ${index} exceeds member byte limit`);
    expandedBytes += size;
    if (!Number.isSafeInteger(expandedBytes) || expandedBytes > resolved.maxExpandedBytes) {
      throw new RangeError('archive expanded byte limit exceeded');
    }
    return Object.freeze({ name, size });
  });

  return Object.freeze({
    members: Object.freeze(normalized),
    memberCount: normalized.length,
    expandedBytes,
  });
}

function validateMemberName(value, index) {
  const name = String(value ?? '');
  if (!name || name.includes('\0')) throw new TypeError(`archive member ${index} name is invalid`);
  if (name.includes('\\')) throw new TypeError(`archive member ${index} uses an unsupported path separator`);
  if (name.startsWith('/') || /^[A-Za-z]:\//.test(name)) throw new TypeError(`archive member ${index} uses an absolute path`);

  const normalized = path.posix.normalize(name);
  if (normalized === '..' || normalized.startsWith('../')) {
    throw new TypeError(`archive member ${index} escapes the extraction root`);
  }
  return normalized;
}

function normalizeLimits(limits) {
  const result = {
    maxMembers: Number(limits?.maxMembers),
    maxExpandedBytes: Number(limits?.maxExpandedBytes),
    maxMemberBytes: Number(limits?.maxMemberBytes),
  };
  for (const [key, value] of Object.entries(result)) {
    if (!Number.isSafeInteger(value) || value <= 0) throw new TypeError(`${key} must be a positive safe integer`);
  }
  return result;
}
