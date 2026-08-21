const SAFE_PREVIEW_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'text/plain',
  'application/pdf',
]);

const EXECUTABLE_EXTENSIONS = new Set([
  'appimage', 'apk', 'bat', 'cmd', 'com', 'cpl', 'deb', 'dll', 'dmg', 'exe', 'hta',
  'jar', 'js', 'jse', 'lnk', 'msi', 'msp', 'pif', 'pkg', 'ps1', 'reg', 'rpm', 'scr',
  'sh', 'vbe', 'vbs', 'wsf',
]);

const EXECUTABLE_MIME_TYPES = new Set([
  'application/java-archive',
  'application/vnd.android.package-archive',
  'application/x-bat',
  'application/x-dosexec',
  'application/x-executable',
  'application/x-msdownload',
  'application/x-msi',
  'application/x-sh',
]);

function normalizedFilename(value) {
  const filename = String(value ?? '').replaceAll('\\', '/').split('/').pop().trim();
  return filename || 'attachment';
}

function extensionOf(filename) {
  const index = filename.lastIndexOf('.');
  return index > 0 ? filename.slice(index + 1).toLowerCase() : '';
}

function normalizedMime(value) {
  return String(value ?? 'application/octet-stream').split(';', 1)[0].trim().toLowerCase() || 'application/octet-stream';
}

export function classifyAttachment({ filename, mimeType, size = null, contentId = null } = {}) {
  const safeFilename = normalizedFilename(filename);
  const extension = extensionOf(safeFilename);
  const mime = normalizedMime(mimeType);
  const executable = EXECUTABLE_EXTENSIONS.has(extension) || EXECUTABLE_MIME_TYPES.has(mime);
  const inline = Boolean(contentId);
  const previewable = !executable && SAFE_PREVIEW_TYPES.has(mime);

  return Object.freeze({
    filename: safeFilename,
    mimeType: mime,
    size: Number.isFinite(Number(size)) && Number(size) >= 0 ? Number(size) : null,
    contentId: contentId ? normalizeContentId(contentId) : null,
    inline,
    executable,
    previewable,
    requiresExplicitDownload: executable || !previewable,
    risk: executable ? 'high' : previewable ? 'normal' : 'caution',
  });
}

export function normalizeContentId(value) {
  const contentId = String(value ?? '').trim().replace(/^<|>$/g, '').trim();
  if (!contentId || /[\r\n\0]/.test(contentId)) throw new TypeError('contentId is invalid');
  return contentId;
}

export function resolveCidReference(reference, attachments = []) {
  const match = /^cid:(.+)$/i.exec(String(reference ?? '').trim());
  if (!match) return null;
  const wanted = normalizeContentId(match[1]);

  const found = attachments
    .map((attachment) => classifyAttachment(attachment))
    .find((attachment) => attachment.contentId === wanted);

  if (!found || found.executable) return null;
  return found;
}

export function sanitizeDownloadFilename(filename) {
  return normalizedFilename(filename)
    .replace(/[\u0000-\u001f\u007f]/g, '_')
    .replace(/[<>:"|?*]/g, '_')
    .slice(0, 240) || 'attachment';
}
