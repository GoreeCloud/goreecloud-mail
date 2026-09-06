import {
  ProviderError,
  PROVIDER_ERROR_CODES,
  normalizeProviderError,
} from './provider-error.js';

const MAX_GATEWAY_ERROR_MESSAGE_LENGTH = 1024;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u;
const GATEWAY_CONTROL_ERROR_CODES = Object.freeze([
  'provider-account-not-found',
]);
const KNOWN_GATEWAY_ERROR_CODES = new Set([
  ...Object.values(PROVIDER_ERROR_CODES),
  ...GATEWAY_CONTROL_ERROR_CODES,
]);

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
    if (typeof error.code !== 'string' || !KNOWN_GATEWAY_ERROR_CODES.has(error.code)) return null;
    if (typeof error.message !== 'string') return null;
    if (
      !error.message ||
      error.message !== error.message.trim() ||
      error.message.length > MAX_GATEWAY_ERROR_MESSAGE_LENGTH ||
      CONTROL_CHARACTERS.test(error.message)
    ) {
      return null;
    }
    if (typeof error.retryable !== 'boolean') return null;

    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
    };
  } catch {
    return null;
  }
}
