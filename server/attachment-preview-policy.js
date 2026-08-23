const PREVIEW_TYPES = Object.freeze({
  IMAGE: 'image-preview',
  PDF: 'pdf-preview',
  NONE: 'no-preview',
});

const BLOCKED_EXTENSIONS = new Set(['exe', 'msi', 'bat', 'cmd', 'scr', 'js', 'vbs']);

function extensionOf(filename = '') {
  const value = filename.toLowerCase();
  const index = value.lastIndexOf('.');
  return index >= 0 ? value.slice(index + 1) : '';
}

export function classifyAttachmentPreview({ filename = '', mimeType = '', byteInspection = {} } = {}) {
  const extension = extensionOf(filename);

  if (BLOCKED_EXTENSIONS.has(extension) || byteInspection.executable === true) {
    return {
      preview: PREVIEW_TYPES.NONE,
      reason: 'executable-content',
    };
  }

  if (mimeType === 'application/pdf') {
    return {
      preview: PREVIEW_TYPES.PDF,
      sandboxRequired: true,
      externalRequestsAllowed: false,
    };
  }

  if (mimeType.startsWith('image/')) {
    return {
      preview: PREVIEW_TYPES.IMAGE,
      metadataRemovalRequired: true,
      externalRequestsAllowed: false,
    };
  }

  return {
    preview: PREVIEW_TYPES.NONE,
    reason: 'unsupported-format',
  };
}
