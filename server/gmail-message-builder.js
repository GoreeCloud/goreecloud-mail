import { createHash } from 'node:crypto';

import { sanitizeMessageHtml } from './restrictive-html-sanitizer.js';
import { ProviderError, PROVIDER_ERROR_CODES } from '../web/providers/provider-error.js';

export const GMAIL_MESSAGE_LIMITS = Object.freeze({
  recipients: 100,
  headerValueChars: 4096,
  subjectChars: 998,
  bodyBytes: 1024 * 1024,
  htmlBytes: 1024 * 1024,
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

  const content = sanitizedHtml === null
    ? buildPlainTextContent(body)
    : buildAlternativeContent({ text: body, html: sanitizedHtml });
  const rfcMessage = `${headers.concat(content.headers).join('\r\n')}\r\n\r\n${content.body}`;

  return Object.freeze({
    raw: Buffer.from(rfcMessage, 'utf8').toString('base64url'),
    byteLength: Buffer.byteLength(rfcMessage, 'utf8'),
    recipientCount: to.length + cc.length + bcc.length,
    messageId,
    contentType: sanitizedHtml === null ? 'text/plain' : 'multipart/alternative',
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
  const boundary = multipartBoundary(text, html);
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

function multipartBoundary(text, html) {
  const digest = createHash('sha256')
    .update(String(text), 'utf8')
    .update('\0')
    .update(String(html), 'utf8')
    .digest('hex');
  return `goreecloud-alt-${digest.slice(0, 32)}`;
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
