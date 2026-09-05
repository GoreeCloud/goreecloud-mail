import { normalizeCapabilities } from '../mail-provider.js';

const MAX_PROVIDER_IDENTIFIER_LENGTH = 512;
const MAX_SEARCH_QUERY_LENGTH = 4096;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u;

function requireOpaqueIdentifier(value, label) {
  if (typeof value !== 'string') {
    throw new TypeError(`${label} must be a string.`);
  }
  if (!value || value !== value.trim()) {
    throw new TypeError(`${label} must use an exact non-blank canonical value.`);
  }
  if (value.length > MAX_PROVIDER_IDENTIFIER_LENGTH) {
    throw new TypeError(`${label} is too long.`);
  }
  if (CONTROL_CHARACTERS.test(value)) {
    throw new TypeError(`${label} must not contain control characters.`);
  }
  return value;
}

function requireSearchQuery(value) {
  if (typeof value !== 'string') {
    throw new TypeError('search query must be a string.');
  }
  if (!value.trim()) {
    throw new TypeError('search query must not be blank.');
  }
  if (value.length > MAX_SEARCH_QUERY_LENGTH) {
    throw new TypeError('search query is too long.');
  }
  if (CONTROL_CHARACTERS.test(value)) {
    throw new TypeError('search query must not contain control characters.');
  }
  // Preserve the exact ordinary query text. Unlike authority identifiers, leading/trailing spaces
  // are not silently normalized; they are encoded as supplied after the bounded validation above.
  return value;
}

function requireFlagState(value) {
  if (typeof value !== 'boolean') {
    throw new TypeError('flagged must be a boolean.');
  }
  return value;
}

export class GatewayMailProvider {
  constructor({ accountId, gateway }) {
    if (!accountId) throw new TypeError('accountId is required.');
    this.accountId = requireOpaqueIdentifier(accountId, 'accountId');
    if (!gateway || typeof gateway.request !== 'function') {
      throw new TypeError('gateway with request() is required.');
    }

    this.gateway = gateway;
  }

  path(suffix = '') {
    return `/accounts/${encodeURIComponent(this.accountId)}${suffix}`;
  }

  authenticate() {
    return this.gateway.request(this.path('/session'));
  }

  listMailboxes() {
    return this.gateway.request(this.path('/mailboxes'));
  }

  listMessages(mailboxId = 'inbox') {
    const scopedMailboxId = requireOpaqueIdentifier(mailboxId, 'mailboxId');
    return this.gateway.request(
      this.path(`/mailboxes/${encodeURIComponent(scopedMailboxId)}/messages`),
    );
  }

  getMessage(id) {
    const scopedMessageId = requireOpaqueIdentifier(id, 'messageId');
    return this.gateway.request(this.path(`/messages/${encodeURIComponent(scopedMessageId)}`));
  }

  search(query) {
    const boundedQuery = requireSearchQuery(query);
    return this.gateway.request(this.path(`/search?q=${encodeURIComponent(boundedQuery)}`));
  }

  send(message) {
    return this.gateway.request(this.path('/messages'), { method: 'POST', body: message });
  }

  createDraft(message) {
    return this.gateway.request(this.path('/drafts'), { method: 'POST', body: message });
  }

  updateDraft(id, message) {
    const scopedDraftId = requireOpaqueIdentifier(id, 'draftId');
    return this.gateway.request(this.path(`/drafts/${encodeURIComponent(scopedDraftId)}`), {
      method: 'PUT',
      body: message,
    });
  }

  move(id, mailboxId) {
    const scopedMessageId = requireOpaqueIdentifier(id, 'messageId');
    const scopedMailboxId = requireOpaqueIdentifier(mailboxId, 'mailboxId');
    return this.gateway.request(this.path(`/messages/${encodeURIComponent(scopedMessageId)}/move`), {
      method: 'POST',
      body: { mailboxId: scopedMailboxId },
    });
  }

  archive(id) {
    const scopedMessageId = requireOpaqueIdentifier(id, 'messageId');
    return this.gateway.request(this.path(`/messages/${encodeURIComponent(scopedMessageId)}/archive`), {
      method: 'POST',
    });
  }

  remove(id) {
    const scopedMessageId = requireOpaqueIdentifier(id, 'messageId');
    return this.gateway.request(this.path(`/messages/${encodeURIComponent(scopedMessageId)}`), {
      method: 'DELETE',
    });
  }

  flag(id, flagged = true) {
    const scopedMessageId = requireOpaqueIdentifier(id, 'messageId');
    const scopedFlagState = requireFlagState(flagged);
    return this.gateway.request(this.path(`/messages/${encodeURIComponent(scopedMessageId)}/flag`), {
      method: 'PUT',
      body: { flagged: scopedFlagState },
    });
  }

  sync() {
    return this.gateway.request(this.path('/sync'), { method: 'POST' });
  }

  async capabilities() {
    const result = await this.gateway.request(this.path('/capabilities'));
    return normalizeCapabilities(result?.capabilities ?? result);
  }
}
