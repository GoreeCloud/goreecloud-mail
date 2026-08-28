import { randomUUID } from 'node:crypto';

export class ProviderAccountNotFoundError extends Error {
  constructor() {
    super('Provider account was not found.');
    this.name = 'ProviderAccountNotFoundError';
    this.status = 404;
    this.code = 'provider-account-not-found';
  }
}

/**
 * Development-only in-memory registry used to prove account isolation semantics.
 * Production persistence must replace this implementation before deployment.
 */
export class InMemoryProviderAccountRegistry {
  #accounts = new Map();

  create({ userId, provider, externalAccountId = null, displayName = null }) {
    if (!userId || !provider) throw new TypeError('userId and provider are required');

    const id = randomUUID();
    const record = Object.freeze({
      id,
      userId,
      provider,
      externalAccountId,
      displayName,
      createdAt: new Date().toISOString(),
    });

    this.#accounts.set(id, record);
    return this.#publicRecord(record);
  }

  listForUser(userId) {
    return [...this.#accounts.values()]
      .filter((record) => record.userId === userId)
      .map((record) => this.#publicRecord(record));
  }

  getForUser(userId, accountId) {
    const record = this.#accounts.get(accountId);
    if (!record || record.userId !== userId) throw new ProviderAccountNotFoundError();
    return this.#publicRecord(record);
  }

  removeForUser(userId, accountId) {
    this.getForUser(userId, accountId);
    this.#accounts.delete(accountId);
  }

  #publicRecord(record) {
    return Object.freeze({
      id: record.id,
      provider: record.provider,
      externalAccountId: record.externalAccountId,
      displayName: record.displayName,
      createdAt: record.createdAt,
    });
  }
}
