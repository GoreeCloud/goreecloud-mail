export function normalizeGmailMessage(message) {
  if (!message || typeof message !== 'object') throw new TypeError('message is required');

  const headers = headerMap(message.payload?.headers);
  const labelIds = Array.isArray(message.labelIds) ? [...message.labelIds] : [];
  const internalDate = Number(message.internalDate || 0);

  return Object.freeze({
    id: String(message.id || ''),
    threadId: message.threadId ? String(message.threadId) : null,
    subject: headers.get('subject') || '(no subject)',
    from: headers.get('from') || '',
    to: splitHeaderList(headers.get('to')),
    cc: splitHeaderList(headers.get('cc')),
    date: Number.isFinite(internalDate) && internalDate > 0 ? new Date(internalDate).toISOString() : null,
    snippet: typeof message.snippet === 'string' ? message.snippet : '',
    unread: labelIds.includes('UNREAD'),
    starred: labelIds.includes('STARRED'),
    labels: labelIds,
    sizeEstimate: Number.isFinite(Number(message.sizeEstimate)) ? Number(message.sizeEstimate) : null,
    hasAttachments: hasAttachment(message.payload),
  });
}

export function normalizeGmailLabel(label) {
  if (!label || typeof label !== 'object') throw new TypeError('label is required');
  return Object.freeze({
    id: String(label.id || ''),
    name: String(label.name || ''),
    type: label.type === 'system' || label.type === 'SYSTEM' ? 'system' : 'user',
    messagesTotal: numericOrNull(label.messagesTotal),
    messagesUnread: numericOrNull(label.messagesUnread),
    threadsTotal: numericOrNull(label.threadsTotal),
    threadsUnread: numericOrNull(label.threadsUnread),
  });
}

function headerMap(headers) {
  const map = new Map();
  for (const header of Array.isArray(headers) ? headers : []) {
    const name = typeof header?.name === 'string' ? header.name.toLowerCase() : '';
    if (name && !map.has(name)) map.set(name, String(header.value || ''));
  }
  return map;
}

function splitHeaderList(value) {
  if (!value) return [];
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function hasAttachment(part) {
  if (!part || typeof part !== 'object') return false;
  if (part.filename && part.body?.attachmentId) return true;
  return Array.isArray(part.parts) && part.parts.some(hasAttachment);
}

function numericOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
