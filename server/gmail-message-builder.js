import { createHash } from 'node:crypto';

import { sanitizeMessageHtml } from './restrictive-html-sanitizer.js';
import { ProviderError, PROVIDER_ERROR_CODES } from '../web/providers/provider-error.js';

export const GMAIL_MESSAGE_LIMITS = Object.freeze({
  recipients: 100,
  headerValueChars: 4096,
  subjectChars: 998,
  bodyBytes: 1024 * 1024,
  htmlBytes: 1024 * 1024,
  attachments: 20,
  attachmentBytes: 10 * 1024 * 1024,
  attachmentTotalBytes: 20 * 1024 * 1024,
  attachmentFilenameChars: 255,
  attachmentContentTypeChars: 255,
});

export function buildGmailRawMessage(input = {}) {
  const to = normalizeAddressList(input.to, { required: true, field: 'to' });
  const cc = normalizeAddressList(input.cc, { field: 'cc' });
  const bcc = normalizeAddressList(input.bcc, { field: 'bcc' });
  const subject = normalizeHeaderValue(input.subject ?? '', 'subject', GMAIL_MESSAGE_LIMITS.subjectChars);
  const from = optionalMailboxValue(input.from, 'from');
  const replyTo = optionalMailboxValue(input.replyTo, 'replyTo');
  const inReplyTo = optionalHeaderValue(input.inReplyTo, 'inReplyTo');
  const references = optionalHeaderValue(input.references, 'references');
  const messageId = optionalMessageId(input.messageId);
  const body = typeof input.body === 'string'
    ? input.body
    : typeof input.text === 'string'
      ? input.text
      : '';
  const requestedHtml = input.html == null ? null : String(input.html);

  requireBodyLimit(body, GMAIL_MESSAGE_LIMITS.bodyBytes, 'message body');
  if (requestedHtml !== null) requireBodyLimit(requestedHtml, GMAIL_MESSAGE_LIMITS.htmlBytes, 'HTML message body');

  const attachments = normalizeAttachments(input.attachments);
  const sanitizedHtml = requestedHtml === null ? null : sanitizeMessageHtml(requestedHtml);
  const headers = [
    `To: ${to.join(', ')}`,
    ...(cc.length ? [`Cc: ${cc.join(', ')}`] : []),
    ...(bcc.length ? [`Bcc: ${bcc.join(', ')}`] : []),
    ...(from ? [`From: ${from}`] : []),
    ...(replyTo ? [`Reply-To: ${replyTo}`] : []),
    ...(messageId ? [`Message-ID: ${messageId}`] : []),
    ...(inReplyTo ? [`In-Reply-To: ${inReplyTo}`] : []),
    ...(references ? [`References: ${references}`] : []),
    `Subject: ${encodeUnstructuredHeader(subject)}`,
    'MIME-Version: 1.0',
  ];

  const bodyContent = sanitizedHtml === null
    ? buildPlainTextContent(body)
    : buildAlternativeContent({ text: body, html: sanitizedHtml });
  const content = attachments.length === 0
    ? bodyContent
    : buildMixedContent({ bodyContent, attachments });
  const rfcMessage = `${headers.concat(content.headers).join('\r\n')}\r\n\r\n${content.body}`;
  const attachmentBytes = attachments.reduce((total, attachment) => total + attachment.bytes.length, 0);

  return Object.freeze({
    raw: Buffer.from(rfcMessage, 'utf8').toString('base64url'),
    byteLength: Buffer.byteLength(rfcMessage, 'utf8'),
    recipientCount: to.length + cc.length + bcc.length,
    messageId,
    contentType: attachments.length > 0
      ? 'multipart/mixed'
      : sanitizedHtml === null
        ? 'text/plain'
        : 'multipart/alternative',
    attachmentCount: attachments.length,
    attachmentBytes,
  });
}

export function decodeGmailRawMessage(raw) {
  if (typeof raw !== 'string' || !/^[A-Za-z0-9_-]*$/.test(raw)) {
    throw new TypeError('raw must be an unpadded base64url string');
  }
  return Buffer.from(raw, 'base64url').toString('utf8');
}

function buildPlainTextContent(body) {
  return {
    headers: [
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
    ],
    body: normalizeBody(body),
  };
}

function buildAlternativeContent({ text, html }) {
  const boundary = multipartBoundary('alt', [text, html]);
  const parts = [
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    normalizeBody(text),
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    normalizeBody(html),
    `--${boundary}--`,
  ];
  return {
    headers: [`Content-Type: multipart/alternative; boundary="${boundary}"`],
    body: parts.join('\r\n'),
  };
}

function buildMixedContent({ bodyContent, attachments }) {
  const boundaryInputs = [
    ...bodyContent.headers,
    bodyContent.body,
    ...attachments.flatMap((attachment) => [
      attachment.filename,
      attachment.contentType,
      attachment.bytes,
    ]),
  ];
  const boundary = multipartBoundary('mixed', boundaryInputs);
  const parts = [
    `--${boundary}`,
    ...bodyContent.headers,
    '',
    bodyContent.body,
  ];

  for (const attachment of attachments) {
    parts.push(
      `--${boundary}`,
      `Content-Type: ${attachment.contentType}; ${mimeFilenameParameters('name', attachment.filename)}`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; ${mimeFilenameParameters('filename', attachment.filename)}`,
      '',
      wrapBase64(attachment.bytes.toString('base64')),
    );
  }
  parts.push(`--${boundary}--`);

  return {
    headers: [`Content-Type: multipart/mixed; boundary="${boundary}"`],
    body: parts.join('\r\n'),
  };
}

function multipartBoundary(kind, values) {
  const hash = createHash('sha256');
  for (const value of values) {
    if (Buffer.isBuffer(value) || value instanceof Uint8Array) hash.update(value);
    else hash.update(String(value), 'utf8');
    hash.update('\0');
  }
  return `goreecloud-${kind}-${hash.digest('hex').slice(0, 32)}`;
}

function normalizeAttachments(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) invalid('attachments must be an array');
  if (value.length > GMAIL_MESSAGE_LIMITS.attachments) {
    invalid('The message has too many attachments.', 413);
  }

  const attachments = value.map((attachment, index) => normalizeAttachment(attachment, index));
  const totalBytes = attachments.reduce((total, attachment) => total + attachment.bytes.length, 0);
  if (totalBytes > GMAIL_MESSAGE_LIMITS.attachmentTotalBytes) {
    invalid('The message attachments exceed the configured total size limit.', 413);
  }
  return attachments;
}

function normalizeAttachment(value, index) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    invalid(`attachment ${index + 1} must be an object`);
  }

  const filename = normalizeAttachmentFilename(value.filename, index);
  const contentType = normalizeAttachmentContentType(value.contentType, index);
  const bytes = normalizeAttachmentBytes(value, index);
  if (bytes.length > GMAIL_MESSAGE_LIMITS.attachmentBytes) {
    invalid(`attachment ${index + 1} exceeds the configured per-file size limit`, 413);
  }
  return Object.freeze({ filename, contentType, bytes });
}

function normalizeAttachmentFilename(value, index) {
  if (typeof value !== 'string') invalid(`attachment ${index + 1} filename must be a string`);
  const filename = value.trim();
  if (!filename) invalid(`attachment ${index + 1} filename is required`);
  if (/[\r\n\0]/.test(filename)) invalid(`attachment ${index + 1} filename contains an invalid header character`);
  if (/[\\/]/.test(filename)) invalid(`attachment ${index + 1} filename must not contain a path separator`);
  if (filename.length > GMAIL_MESSAGE_LIMITS.attachmentFilenameChars) {
    invalid(`attachment ${index + 1} filename exceeds the configured limit`, 413);
  }
  return filename;
}

function normalizeAttachmentContentType(value, index) {
  if (value == null || value === '') return 'application/octet-stream';
  if (typeof value !== 'string') invalid(`attachment ${index + 1} contentType must be a string`);
  const contentType = value.trim();
  if (contentType.length > GMAIL_MESSAGE_LIMITS.attachmentContentTypeChars) {
    invalid(`attachment ${index + 1} contentType exceeds the configured limit`, 413);
  }
  if (!/^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+$/.test(contentType)) {
    invalid(`attachment ${index + 1} contentType must be a simple MIME media type`);
  }
  return contentType.toLowerCase();
}

function normalizeAttachmentBytes(value, index) {
  if (Buffer.isBuffer(value.bytes) || value.bytes instanceof Uint8Array) {
    return Buffer.from(value.bytes);
  }
  if (typeof value.contentBase64 !== 'string') {
    invalid(`attachment ${index + 1} requires bytes or contentBase64`);
  }
  if (!isCanonicalBase64(value.contentBase64)) {
    invalid(`attachment ${index + 1} contentBase64 must be canonical base64`);
  }
  return Buffer.from(value.contentBase64, 'base64');
}

function isCanonicalBase64(value) {
  if (value === '') return true;
  if (value.length % 4 !== 0) return false;
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) return false;
  const decoded = Buffer.from(value, 'base64');
  return decoded.toString('base64') === value;
}

function mimeFilenameParameters(key, filename) {
  const asciiFallback = filename
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/["\\]/g, '_');
  const quoted = `${key}="${asciiFallback}"`;
  if (/^[\x20-\x7E]+$/.test(filename)) return quoted;
  return `${quoted}; ${key}*=UTF-8''${encodeRfc2231Value(filename)}`;
}

function encodeRfc2231Value(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function wrapBase64(value) {
  if (!value) return '';
  return value.match(/.{1,76}/g).join('\r\n');
}

function normalizeBody(value) {
  return String(value).replace(/\r?\n/g, '\r\n');
}

function requireBodyLimit(value, maxBytes, label) {
  if (Buffer.byteLength(value, 'utf8') > maxBytes) {
    throw new ProviderError(`The ${label} exceeds the configured Gmail composition limit.`, {
      code: PROVIDER_ERROR_CODES.INVALID_REQUEST,
      status: 413,
    });
  }
}

function normalizeAddressList(value, { required = false, field }) {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];
  const result = [];

  for (const item of values) {
    if (typeof item !== 'string') invalid(`${field} recipients must be strings`);
    for (const part of item.split(',')) {
      const address = normalizeMailboxValue(part.trim(), field);
      if (address) result.push(address);
    }
  }

  if (required && result.length === 0) invalid('At least one recipient is required.');
  if (result.length > GMAIL_MESSAGE_LIMITS.recipients) {
    invalid('The message has too many recipients.', 413);
  }
  return result;
}

function optionalMailboxValue(value, field) {
  if (value == null || value === '') return null;
  return normalizeMailboxValue(value, field);
}

function normalizeMailboxValue(value, field) {
  const normalized = normalizeHeaderValue(value, field, GMAIL_MESSAGE_LIMITS.headerValueChars);
  if (!normalized) return '';
  if (!/^[^\s@<>,]+@[^\s@<>,]+$/.test(normalized)) {
    invalid(`${field} must use a simple mailbox address`);
  }
  return normalized;
}

function optionalHeaderValue(value, field) {
  if (value == null || value === '') return null;
  return normalizeHeaderValue(value, field, GMAIL_MESSAGE_LIMITS.headerValueChars);
}

function optionalMessageId(value) {
  if (value == null || value === '') return null;
  const normalized = normalizeHeaderValue(value, 'messageId', GMAIL_MESSAGE_LIMITS.headerValueChars);
  if (!/^<[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+>$/.test(normalized)) {
    invalid('messageId must be a single RFC-style Message-ID value');
  }
  return normalized;
}

function normalizeHeaderValue(value, field, maxChars) {
  if (typeof value !== 'string') invalid(`${field} must be a string`);
  const normalized = value.trim();
  if (/\r|\n|\0/.test(normalized)) invalid(`${field} contains an invalid header character`);
  if (normalized.length > maxChars) invalid(`${field} exceeds the configured header limit`, 413);
  return normalized;
}

function encodeUnstructuredHeader(value) {
  if (!value) return '';
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

function invalid(message, status = 400) {
  throw new ProviderError(message, {
    code: PROVIDER_ERROR_CODES.INVALID_REQUEST,
    status,
  });
}
