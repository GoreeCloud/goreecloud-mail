export class CredentialNotFoundError extends Error {
  constructor() {
    super('Provider credential was not found.');
    this.name = 'CredentialNotFoundError';
    this.status = 404;
    this.code = 'credential-not-found';
  }
}

/**
 * Development-only in-memory secret vault.
 *
 * This implementation proves scoping and non-disclosure semantics only. It is
 * not approved for production persistence. Production must use an approved
 * encrypted secret store with lifecycle, backup, recovery, and access controls.
 */
export class InMemoryCredentialVault {
  #entries = new Map();

  put({ userId, accountId, provider, secret }) {
    if (!userId || !accountId || !provider) throw new TypeError('userId, accountId, and provider are required');
    if (!secret || typeof secret !== 'object') throw new TypeError('secret is required');

    const key = this.#key(userId, accountId);
    this.#entries.set(key, {
      userId,
      accountId,
      provider,
      secret: structuredClone(secret),
      updatedAt: new Date().toISOString(),
    });

    return this.describe({ userId, accountId });
  }

  get({ userId, accountId }) {
    const entry = this.#entries.get(this.#key(userId, accountId));
    if (!entry) throw new CredentialNotFoundError();
    return structuredClone(entry.secret);
  }

  describe({ userId, accountId }) {
    const entry = this.#entries.get(this.#key(userId, accountId));
    if (!entry) throw new CredentialNotFoundError();
    return Object.freeze({
      accountId: entry.accountId,
      provider: entry.provider,
      updatedAt: entry.updatedAt,
      configured: true,
    });
  }

  remove({ userId, accountId }) {
    const key = this.#key(userId, accountId);
    if (!this.#entries.has(key)) throw new CredentialNotFoundError();
    this.#entries.delete(key);
    return { removed: true };
  }

  #key(userId, accountId) {
    return `${userId}\u0000${accountId}`;
  }
}
