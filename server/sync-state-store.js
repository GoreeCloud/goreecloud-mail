export class SyncStateNotFoundError extends Error {
  constructor() {
    super('Synchronization state was not found.');
    this.name = 'SyncStateNotFoundError';
    this.status = 404;
    this.code = 'sync-state-not-found';
  }
}

/**
 * Development-only synchronization-state store.
 *
 * This mirrors the durable schema semantics while keeping tests dependency-free.
 * Production must replace it with approved persistence and transactional updates.
 */
export class InMemorySyncStateStore {
  #cursors = new Map();
  #mailboxes = new Map();

  putCursor({ userId, accountId, provider, cursorType, cursorValue }) {
    for (const [name, value] of Object.entries({ userId, accountId, provider, cursorType, cursorValue })) {
      if (!value) throw new TypeError(`${name} is required`);
    }
    const record = Object.freeze({
      userId,
      accountId,
      provider,
      cursorType,
      cursorValue,
      updatedAt: new Date().toISOString(),
    });
    this.#cursors.set(this.#cursorKey(userId, accountId, cursorType), record);
    return this.#publicCursor(record);
  }

  getCursor({ userId, accountId, cursorType }) {
    const record = this.#cursors.get(this.#cursorKey(userId, accountId, cursorType));
    if (!record) throw new SyncStateNotFoundError();
    return this.#publicCursor(record);
  }

  removeCursor({ userId, accountId, cursorType }) {
    const key = this.#cursorKey(userId, accountId, cursorType);
    if (!this.#cursors.has(key)) throw new SyncStateNotFoundError();
    this.#cursors.delete(key);
    return { removed: true };
  }

  recordMailboxAttempt({ userId, accountId, mailboxId, errorCode = null, attemptedAt = new Date().toISOString() }) {
    const key = this.#mailboxKey(userId, accountId, mailboxId);
    const prior = this.#mailboxes.get(key);
    const record = Object.freeze({
      userId,
      accountId,
      mailboxId,
      lastSuccessfulSyncAt: prior?.lastSuccessfulSyncAt || null,
      lastAttemptedSyncAt: attemptedAt,
      lastErrorCode: errorCode || null,
    });
    this.#mailboxes.set(key, record);
    return this.#publicMailbox(record);
  }

  recordMailboxSuccess({ userId, accountId, mailboxId, syncedAt = new Date().toISOString() }) {
    const record = Object.freeze({
      userId,
      accountId,
      mailboxId,
      lastSuccessfulSyncAt: syncedAt,
      lastAttemptedSyncAt: syncedAt,
      lastErrorCode: null,
    });
    this.#mailboxes.set(this.#mailboxKey(userId, accountId, mailboxId), record);
    return this.#publicMailbox(record);
  }

  getMailboxState({ userId, accountId, mailboxId }) {
    const record = this.#mailboxes.get(this.#mailboxKey(userId, accountId, mailboxId));
    if (!record) throw new SyncStateNotFoundError();
    return this.#publicMailbox(record);
  }

  #cursorKey(userId, accountId, cursorType) {
    return `${userId}\u0000${accountId}\u0000${cursorType}`;
  }

  #mailboxKey(userId, accountId, mailboxId) {
    return `${userId}\u0000${accountId}\u0000${mailboxId}`;
  }

  #publicCursor(record) {
    return Object.freeze({
      accountId: record.accountId,
      provider: record.provider,
      cursorType: record.cursorType,
      cursorValue: record.cursorValue,
      updatedAt: record.updatedAt,
    });
  }

  #publicMailbox(record) {
    return Object.freeze({
      accountId: record.accountId,
      mailboxId: record.mailboxId,
      lastSuccessfulSyncAt: record.lastSuccessfulSyncAt,
      lastAttemptedSyncAt: record.lastAttemptedSyncAt,
      lastErrorCode: record.lastErrorCode,
    });
  }
}
