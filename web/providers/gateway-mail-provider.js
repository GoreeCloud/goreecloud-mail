import { normalizeCapabilities } from '../mail-provider.js';

export class GatewayMailProvider {
  constructor({ providerId, gateway }) {
    if (!providerId) throw new TypeError('providerId is required.');
    if (!gateway || typeof gateway.request !== 'function') {
      throw new TypeError('gateway with request() is required.');
    }

    this.providerId = providerId;
    this.gateway = gateway;
  }

  path(suffix = '') {
    return `/providers/${encodeURIComponent(this.providerId)}${suffix}`;
  }

  authenticate() {
    return this.gateway.request(this.path('/session'));
  }

  listMailboxes() {
    return this.gateway.request(this.path('/mailboxes'));
  }

  listMessages(mailboxId = 'inbox') {
    return this.gateway.request(this.path(`/mailboxes/${encodeURIComponent(mailboxId)}/messages`));
  }

  getMessage(id) {
    return this.gateway.request(this.path(`/messages/${encodeURIComponent(id)}`));
  }

  search(query) {
    return this.gateway.request(this.path(`/search?q=${encodeURIComponent(query)}`));
  }

  send(message) {
    return this.gateway.request(this.path('/messages'), { method: 'POST', body: message });
  }

  createDraft(message) {
    return this.gateway.request(this.path('/drafts'), { method: 'POST', body: message });
  }

  updateDraft(id, message) {
    return this.gateway.request(this.path(`/drafts/${encodeURIComponent(id)}`), {
      method: 'PUT',
      body: message,
    });
  }

  move(id, mailboxId) {
    return this.gateway.request(this.path(`/messages/${encodeURIComponent(id)}/move`), {
      method: 'POST',
      body: { mailboxId },
    });
  }

  archive(id) {
    return this.gateway.request(this.path(`/messages/${encodeURIComponent(id)}/archive`), {
      method: 'POST',
    });
  }

  remove(id) {
    return this.gateway.request(this.path(`/messages/${encodeURIComponent(id)}`), {
      method: 'DELETE',
    });
  }

  flag(id, flagged = true) {
    return this.gateway.request(this.path(`/messages/${encodeURIComponent(id)}/flag`), {
      method: 'PUT',
      body: { flagged },
    });
  }

  sync() {
    return this.gateway.request(this.path('/sync'), { method: 'POST' });
  }

  async capabilities() {
    return normalizeCapabilities(await this.gateway.request(this.path('/capabilities')));
  }
}
