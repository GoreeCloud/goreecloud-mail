import { ProviderError, PROVIDER_ERROR_CODES, normalizeProviderError } from '../web/providers/provider-error.js';

const DEFAULT_RETRY_STATUSES = new Set([429, 502, 503, 504]);

export async function runProviderRequest(operation, {
  timeoutMs = 10_000,
  maxAttempts = 3,
  baseDelayMs = 200,
  maxDelayMs = 2_000,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  retryStatuses = DEFAULT_RETRY_STATUSES,
} = {}) {
  if (typeof operation !== 'function') throw new TypeError('operation is required');
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new TypeError('timeoutMs must be positive');
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) throw new TypeError('maxAttempts must be at least 1');

  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await operation({ attempt, signal: controller.signal });
    } catch (error) {
      lastError = normalizeRequestError(error);
      if (attempt >= maxAttempts || !isRetryable(lastError, retryStatuses)) throw lastError;

      const retryAfterMs = boundedRetryAfter(error?.retryAfterMs, maxDelayMs);
      const exponentialMs = Math.min(baseDelayMs * (2 ** (attempt - 1)), maxDelayMs);
      await sleep(retryAfterMs ?? exponentialMs);
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError;
}

function normalizeRequestError(error) {
  if (error?.name === 'AbortError') {
    return new ProviderError('The provider request timed out.', {
      code: PROVIDER_ERROR_CODES.TEMPORARY,
      status: 503,
      retryable: true,
    });
  }
  return normalizeProviderError(error);
}

function isRetryable(error, retryStatuses) {
  return Boolean(error?.retryable || retryStatuses.has(Number(error?.status || 0)));
}

function boundedRetryAfter(value, maxDelayMs) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.min(number, maxDelayMs);
}
