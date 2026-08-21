import { randomBytes } from 'node:crypto';

export class OAuthStateError extends Error {
  constructor(message = 'OAuth authorization state is invalid or expired.') {
    super(message);
    this.name = 'OAuthStateError';
    this.status = 400;
    this.code = 'invalid-oauth-state';
  }
}

/**
 * Development-only in-memory state store.
 *
 * Production must use durable or shared server-side storage appropriate for the
 * deployment topology. State values are single-use, short-lived, user-scoped,
 * provider-scoped, and restricted to approved application-relative redirects.
 */
export class InMemoryOAuthStateStore {
  #entries = new Map();

  constructor({ ttlMs = 10 * 60 * 1000, now = () => Date.now() } = {}) {
    this.ttlMs = ttlMs;
    this.now = now;
  }

  issue({ userId, provider, redirectPath = '/' }) {
    if (!userId || !provider) throw new TypeError('userId and provider are required');
    if (!isApprovedRedirectPath(redirectPath)) throw new TypeError('redirectPath must be an application-relative path');

    const state = randomBytes(32).toString('base64url');
    this.#entries.set(state, {
      userId,
      provider,
      redirectPath,
      expiresAt: this.now() + this.ttlMs,
    });

    return state;
  }

  consume({ state, userId, provider }) {
    const entry = this.#entries.get(state);
    this.#entries.delete(state);

    if (!entry || entry.expiresAt <= this.now()) throw new OAuthStateError();
    if (entry.userId !== userId || entry.provider !== provider) throw new OAuthStateError();

    return Object.freeze({ redirectPath: entry.redirectPath });
  }

  purgeExpired() {
    const now = this.now();
    for (const [state, entry] of this.#entries.entries()) {
      if (entry.expiresAt <= now) this.#entries.delete(state);
    }
  }
}

export function isApprovedRedirectPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/')) return false;
  if (value.startsWith('//')) return false;

  try {
    const url = new URL(value, 'https://mail.goreecloud.invalid');
    return url.origin === 'https://mail.goreecloud.invalid';
  } catch {
    return false;
  }
}
