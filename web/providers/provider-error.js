export const PROVIDER_ERROR_CODES = Object.freeze({
  AUTH_REQUIRED: 'auth-required',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'not-found',
  RATE_LIMITED: 'rate-limited',
  TEMPORARY: 'temporary-provider-failure',
  UNSUPPORTED: 'unsupported-operation',
  CAPABILITY_UNAVAILABLE: 'provider-capability-unavailable',
  INVALID_REQUEST: 'invalid-request',
  UNKNOWN: 'provider-failure',
});

export class ProviderError extends Error {
  constructor(message, { code = PROVIDER_ERROR_CODES.UNKNOWN, status = 502, retryable = false } = {}) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

export function normalizeProviderError(error) {
  if (error instanceof ProviderError) return error;

  const status = Number(error?.status || error?.response?.status || 0);

  if (status === 400) return new ProviderError('The provider rejected the request.', { code: PROVIDER_ERROR_CODES.INVALID_REQUEST, status: 400 });
  if (status === 401) return new ProviderError('Provider authorization is required.', { code: PROVIDER_ERROR_CODES.AUTH_REQUIRED, status: 401 });
  if (status === 403) return new ProviderError('The provider denied this operation.', { code: PROVIDER_ERROR_CODES.FORBIDDEN, status: 403 });
  if (status === 404) return new ProviderError('The requested mail object was not found.', { code: PROVIDER_ERROR_CODES.NOT_FOUND, status: 404 });
  if (status === 429) return new ProviderError('The provider is temporarily rate limiting requests.', { code: PROVIDER_ERROR_CODES.RATE_LIMITED, status: 429, retryable: true });
  if (status >= 500) return new ProviderError('The provider is temporarily unavailable.', { code: PROVIDER_ERROR_CODES.TEMPORARY, status: 503, retryable: true });

  return new ProviderError('The mail provider request failed.');
}

export function publicProviderError(error) {
  const normalized = normalizeProviderError(error);
  return {
    error: {
      code: normalized.code,
      message: normalized.message,
      retryable: normalized.retryable,
    },
  };
}
