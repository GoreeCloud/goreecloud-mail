import { normalizeGmailLabel, normalizeGmailMessage } from './gmail-normalizer.js';
import { normalizeProviderError } from '../web/providers/provider-error.js';

export const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

export class GmailApiClient {
  constructor({ tokenResolver, fetchImpl = globalThis.fetch, apiBase = GMAIL_API_BASE } = {}) {
    if (typeof tokenResolver !== 'function') throw new TypeError('tokenResolver is required');
    if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl is required');
    this.tokenResolver = tokenResolver;
    this.fetchImpl = fetchImpl;
    this.apiBase = apiBase.replace(/\/$/, '');
  }

  async listLabels(context) {
    const payload = await this.#request('/labels', context);
    return (payload.labels || []).map(normalizeGmailLabel);
  }

  async listMessages(context, { query = null, labelIds = [], maxResults = 50, pageToken = null } = {}) {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    for (const labelId of labelIds) params.append('labelIds', labelId);
    params.set('maxResults', String(Math.min(Math.max(Number(maxResults) || 50, 1), 100)));
    if (pageToken) params.set('pageToken', pageToken);

    const listing = await this.#request(`/messages?${params}`, context);
    return {
      messageRefs: (listing.messages || []).map((item) => ({ id: item.id, threadId: item.threadId || null })),
      nextPageToken: listing.nextPageToken || null,
      resultSizeEstimate: Number(listing.resultSizeEstimate || 0),
    };
  }

  async getMessage(context, messageId) {
    if (!messageId) throw new TypeError('messageId is required');
    const payload = await this.#request(`/messages/${encodeURIComponent(messageId)}?format=full`, context);
    return normalizeGmailMessage(payload);
  }

  async #request(path, context) {
    const accessToken = await this.tokenResolver(context);
    if (!accessToken) throw new Error('Gmail access token is unavailable.');

    try {
      const response = await this.fetchImpl(`${this.apiBase}${path}`, {
        method: 'GET',
        headers: {
          authorization: `Bearer ${accessToken}`,
          accept: 'application/json',
        },
      });

      if (!response.ok) {
        const error = new Error('Gmail API request failed.');
        error.status = response.status;
        throw error;
      }
      return await response.json();
    } catch (error) {
      throw normalizeProviderError(error);
    }
  }
}
