import { ProviderError, normalizeProviderError } from './provider-error.js';

export class ProviderGateway {
  constructor({ baseUrl = '/api/mail', fetchImpl = globalThis.fetch } = {}) {
    if (typeof fetchImpl !== 'function') {
      throw new TypeError('Provider gateway requires a fetch implementation.');
    }

    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.fetchImpl = fetchImpl;
  }

  async request(path, { method = 'GET', body, signal } = {}) {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const bounded = await readBoundedGatewayError(response);
      if (bounded) {
        throw new ProviderError(bounded.message, {
          code: bounded.code,
          status: response.status,
          retryable: bounded.retryable,
        });
      }

      const error = new Error(`Mail gateway request failed with status ${response.status}.`);
      error.status = response.status;
      throw normalizeProviderError(error);
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  }
}

async function readBoundedGatewayError(response) {
  try {
    const payload = await response.json();
    const error = payload?.error;
    if (!error || typeof error !== 'object') return null;
    if (typeof error.code !== 'string' || typeof error.message !== 'string') return null;
    return {
      code: error.code,
      message: error.message,
      retryable: Boolean(error.retryable),
    };
  } catch {
    return null;
  }
}
