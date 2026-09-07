import {
  ProviderError,
  PROVIDER_ERROR_CODES,
  normalizeProviderError,
} from './provider-error.js';

const MAX_GATEWAY_ERROR_MESSAGE_LENGTH = 1024;
const MAX_GATEWAY_ERROR_PAYLOAD_BYTES = 8192;
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
    const encoded = await readBoundedResponseBytes(response, MAX_GATEWAY_ERROR_PAYLOAD_BYTES);
    if (!encoded) return null;

    const text = new TextDecoder('utf-8', { fatal: true }).decode(encoded);
    const payload = JSON.parse(text);
    const error = payload?.error;
    if (!error || typeof error !== 'object' || Array.isArray(error)) return null;
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

async function readBoundedResponseBytes(response, maximumBytes) {
  const contentLength = response.headers?.get?.('content-length');
  if (contentLength !== null && contentLength !== undefined) {
    const declaredLength = Number(contentLength);
    if (
      !Number.isSafeInteger(declaredLength) ||
      declaredLength < 0 ||
      declaredLength > maximumBytes
    ) {
      return null;
    }
  }

  const reader = response.body?.getReader?.();
  if (!reader) return null;

  const chunks = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) return null;

      totalBytes += value.byteLength;
      if (totalBytes > maximumBytes) {
        await reader.cancel('Mail gateway error payload exceeded the bounded projection limit.');
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock?.();
  }

  const encoded = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    encoded.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return encoded;
}
