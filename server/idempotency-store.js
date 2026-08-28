export class IdempotencyConflictError extends Error {
  constructor() {
    super('An operation with this idempotency key is already in progress or has incompatible input.');
    this.name = 'IdempotencyConflictError';
    this.status = 409;
    this.code = 'idempotency-conflict';
  }
}

export class IdempotencyNotFoundError extends Error {
  constructor() {
    super('Idempotency record was not found.');
    this.name = 'IdempotencyNotFoundError';
    this.status = 404;
    this.code = 'idempotency-not-found';
  }
}

/** Development-only operation idempotency store. */
export class InMemoryIdempotencyStore {
  #records = new Map();

  begin({ userId, accountId, operation, key, fingerprint }) {
    for (const [name, value] of Object.entries({ userId, accountId, operation, key, fingerprint })) {
      if (!value) throw new TypeError(`${name} is required`);
    }
    const storageKey = this.#key(userId, accountId, operation, key);
    const prior = this.#records.get(storageKey);
    if (prior) {
      if (prior.fingerprint !== fingerprint) throw new IdempotencyConflictError();
      return this.#public(prior);
    }
    const record = Object.freeze({
      userId,
      accountId,
      operation,
      key,
      fingerprint,
      status: 'in-progress',
      result: null,
      errorCode: null,
      createdAt: new Date().toISOString(),
      completedAt: null,
    });
    this.#records.set(storageKey, record);
    return this.#public(record);
  }

  complete({ userId, accountId, operation, key, result = null }) {
    return this.#replace({ userId, accountId, operation, key }, (prior) => ({
      ...prior,
      status: 'completed',
      result: structuredClone(result),
      errorCode: null,
      completedAt: new Date().toISOString(),
    }));
  }

  fail({ userId, accountId, operation, key, errorCode }) {
    if (!errorCode) throw new TypeError('errorCode is required');
    return this.#replace({ userId, accountId, operation, key }, (prior) => ({
      ...prior,
      status: 'failed',
      result: null,
      errorCode,
      completedAt: new Date().toISOString(),
    }));
  }

  get({ userId, accountId, operation, key }) {
    const record = this.#records.get(this.#key(userId, accountId, operation, key));
    if (!record) throw new IdempotencyNotFoundError();
    return this.#public(record);
  }

  #replace(scope, updater) {
    const storageKey = this.#key(scope.userId, scope.accountId, scope.operation, scope.key);
    const prior = this.#records.get(storageKey);
    if (!prior) throw new IdempotencyNotFoundError();
    const next = Object.freeze(updater(prior));
    this.#records.set(storageKey, next);
    return this.#public(next);
  }

  #key(userId, accountId, operation, key) {
    return `${userId}\u0000${accountId}\u0000${operation}\u0000${key}`;
  }

  #public(record) {
    return Object.freeze({
      accountId: record.accountId,
      operation: record.operation,
      key: record.key,
      status: record.status,
      result: structuredClone(record.result),
      errorCode: record.errorCode,
      createdAt: record.createdAt,
      completedAt: record.completedAt,
    });
  }
}
