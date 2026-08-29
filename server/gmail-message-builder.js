import { ProviderError, PROVIDER_ERROR_CODES } from '../web/providers/provider-error.js';

export const GMAIL_MESSAGE_LIMITS = Object.freeze({
  recipients: 100,
  headerValueChars: 4096,
  subjectChars: 998,
  bodyBytes: 1024 * 1024,
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
  const body = typeof input.body === 'string'
    ? input.body
    : typeof input.text === 'string'
      ? input.text
      : '';

  const bodyBytes = Buffer.byteLength(body, 'utf8');
  if (bodyBytes > GMAIL_MESSAGE_LIMITS.bodyBytes) {
    throw new ProviderError('The message body exceeds the configured Gmail composition limit.', {
      code: PROVIDER_ERROR_CODES.INVALID_REQUEST,
      status: 413,
    });
  }

  const headers = [
    `To: ${to.join(', ')}`,
    ...(cc.length ? [`Cc: ${cc.join(', ')}`] : []),
    ...(bcc.length ? [`Bcc: ${bcc.join(', ')}`] : []),
    ...(from ? [`From: ${from}`] : []),
    ...(replyTo ? [`Reply-To: ${replyTo}`] : []),
    ...(inReplyTo ? [`In-Reply-To: ${inReplyTo}`] : []),
    ...(references ? [`References: ${references}`] : []),
    `Subject: ${encodeUnstructuredHeader(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
  ];

  const normalizedBody = body.replace(/\r?\n/g, '\r\n');
  const rfcMessage = `${headers.join('\r\n')}\r\n\r\n${normalizedBody}`;

  return Object.freeze({
    raw: Buffer.from(rfcMessage, 'utf8').toString('base64url'),
    byteLength: Buffer.byteLength(rfcMessage, 'utf8'),
    recipientCount: to.length + cc.length + bcc.length,
  });
}

export function decodeGmailRawMessage(raw) {
  if (typeof raw !== 'string' || !/^[A-Za-z0-9_-]*$/.test(raw)) {
    throw new TypeError('raw must be an unpadded base64url string');
  }
  return Buffer.from(raw, 'base64url').toString('utf8');
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
