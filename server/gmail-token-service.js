import { GMAIL_TOKEN_ENDPOINT } from './gmail-oauth.js';
import { normalizeProviderError, ProviderError, PROVIDER_ERROR_CODES } from '../web/providers/provider-error.js';

const EXPIRY_SKEW_MS = 60_000;

export class GmailTokenService {
  constructor({ credentialVault, fetchImpl = globalThis.fetch, tokenEndpoint = GMAIL_TOKEN_ENDPOINT, now = () => Date.now() } = {}) {
    if (!credentialVault) throw new TypeError('credentialVault is required');
    if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl is required');
    this.credentialVault = credentialVault;
    this.fetchImpl = fetchImpl;
    this.tokenEndpoint = tokenEndpoint;
    this.now = now;
  }

  async resolveAccessToken({ userId, accountId, clientId, clientSecret = null }) {
    if (!userId || !accountId || !clientId) throw new TypeError('userId, accountId, and clientId are required');
    const secret = this.credentialVault.get({ userId, accountId });

    if (secret.accessToken && Number(secret.expiresAt || 0) > this.now() + EXPIRY_SKEW_MS) {
      return secret.accessToken;
    }

    if (!secret.refreshToken) {
      throw new ProviderError('Provider authorization is required.', {
        code: PROVIDER_ERROR_CODES.AUTH_REQUIRED,
        status: 401,
      });
    }

    const refreshed = await this.#refresh({
      refreshToken: secret.refreshToken,
      clientId,
      clientSecret,
    });

    const expiresAt = this.now() + Math.max(Number(refreshed.expires_in || 0), 0) * 1000;
    this.credentialVault.put({
      userId,
      accountId,
      provider: 'gmail',
      secret: {
        ...secret,
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token || secret.refreshToken,
        tokenType: refreshed.token_type || secret.tokenType || 'Bearer',
        scope: refreshed.scope || secret.scope || null,
        expiresAt,
      },
    });

    return refreshed.access_token;
  }

  async revoke({ userId, accountId }) {
    this.credentialVault.remove({ userId, accountId });
    return { revoked: true };
  }

  async #refresh({ refreshToken, clientId, clientSecret }) {
    const body = new URLSearchParams({
      client_id: clientId,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });
    if (clientSecret) body.set('client_secret', clientSecret);

    try {
      const response = await this.fetchImpl(this.tokenEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
        body,
      });
      if (!response.ok) {
        const error = new Error('Gmail token refresh failed.');
        error.status = response.status;
        throw error;
      }
      const payload = await response.json();
      if (!payload?.access_token) {
        const error = new Error('Gmail token response did not contain an access token.');
        error.status = 502;
        throw error;
      }
      return payload;
    } catch (error) {
      throw normalizeProviderError(error);
    }
  }
}
