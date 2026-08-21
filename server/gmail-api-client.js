import { normalizeGmailLabel, normalizeGmailMessage } from './gmail-normalizer.js';
import { normalizeProviderError } from '../web/providers/provider-error.js';
import { runProviderRequest } from './provider-request-policy.js';

export const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

export class GmailApiClient {
  constructor({
    tokenResolver,
    fetchImpl = globalThis.fetch,
    apiBase = GMAIL_API_BASE,
    requestPolicy = runProviderRequest,
    requestPolicyOptions = {},
  } = {}) {
    if (typeof tokenResolver !== 'function') throw new TypeError('tokenResolver is required');
    if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl is required');
    if (typeof requestPolicy !== 'function') throw new TypeError('requestPolicy is required');
    this.tokenResolver = tokenResolver;
    this.fetchImpl = fetchImpl;
    this.apiBase = apiBase.replace(/\/$/, '');
    this.requestPolicy = requestPolicy;
    this.requestPolicyOptions = { ...requestPolicyOptions };
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
      return await this.requestPolicy(async ({ signal }) => {
        const response = await this.fetchImpl(`${this.apiBase}${path}`, {
          method: 'GET',
          signal,
          headers: {
            authorization: `Bearer ${accessToken}`,
            accept: 'application/json',
          },
        });

        if (!response.ok) {
          const error = new Error('Gmail API request failed.');
          error.status = response.status;
          error.retryAfterMs = parseRetryAfter(response.headers?.get?.('retry-after'));
          throw error;
        }
        return await response.json();
      }, this.requestPolicyOptions);
    } catch (error) {
      throw normalizeProviderError(error);
    }
  }
}

function parseRetryAfter(value) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return null;
  return Math.max(date - Date.now(), 0);
}
