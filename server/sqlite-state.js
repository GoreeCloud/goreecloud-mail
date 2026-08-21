import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { ProviderAccountNotFoundError } from './provider-account-registry.js';
import { SyncStateNotFoundError } from './sync-state-store.js';
import {
  IdempotencyConflictError,
  IdempotencyNotFoundError,
} from './idempotency-store.js';

const SCHEMA = readFileSync(new URL('../docs/persistence-schema.sql', import.meta.url), 'utf8');

function required(values) {
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === '') {
      throw new TypeError(`${name} is required`);
    }
  }
}

function publicAccount(row) {
  return Object.freeze({
    id: row.id,
    provider: row.provider,
    externalAccountId: row.external_account_id ?? null,
    displayName: row.display_name ?? null,
    createdAt: row.created_at,
  });
}

function publicCursor(row) {
  return Object.freeze({
    accountId: row.account_id,
    provider: row.provider,
    cursorType: row.cursor_type,
    cursorValue: row.cursor_value,
    updatedAt: row.updated_at,
  });
}

function publicMailbox(row) {
  return Object.freeze({
    accountId: row.account_id,
    mailboxId: row.mailbox_id,
    lastSuccessfulSyncAt: row.last_successful_sync_at ?? null,
    lastAttemptedSyncAt: row.last_attempted_sync_at ?? null,
    lastErrorCode: row.last_error_code ?? null,
  });
}

function parseResult(value) {
  if (value === null || value === undefined) return null;
  return structuredClone(JSON.parse(value));
}

function publicIdempotency(row) {
  return Object.freeze({
    accountId: row.account_id,
    operation: row.operation,
    key: row.idempotency_key,
    status: row.status,
    result: parseResult(row.result_json),
    errorCode: row.error_code ?? null,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? null,
  });
}

/**
 * Durable GoreeCloud Mail application-state store backed by SQLite.
 *
 * Reusable provider credentials are intentionally not stored here. Only vault
 * references belong in the application database.
 */
export class SqliteMailState {
  #db;

  constructor({ path = ':memory:' } = {}) {
    this.#db = new DatabaseSync(path);
    this.#db.exec('PRAGMA foreign_keys = ON;');
    this.#db.exec('PRAGMA journal_mode = WAL;');
    this.#db.exec(SCHEMA);
  }

  close() {
    this.#db.close();
  }

  transaction(callback) {
    if (typeof callback !== 'function') throw new TypeError('callback is required');
    this.#db.exec('BEGIN IMMEDIATE;');
    try {
      const result = callback(this);
      this.#db.exec('COMMIT;');
      return result;
    } catch (error) {
      this.#db.exec('ROLLBACK;');
      throw error;
    }
  }

  createProviderAccount({ userId, provider, externalAccountId = null, displayName = null }) {
    required({ userId, provider });
    const id = randomUUID();
    const now = new Date().toISOString();
    this.#db.prepare(`
      INSERT INTO provider_accounts
        (id, user_id, provider, external_account_id, display_name, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
    `).run(id, userId, provider, externalAccountId, displayName, now, now);
    return this.getProviderAccountForUser(userId, id);
  }

  listProviderAccountsForUser(userId) {
    required({ userId });
    return this.#db.prepare(`
      SELECT id, provider, external_account_id, display_name, created_at
      FROM provider_accounts
      WHERE user_id = ? AND status = 'active'
      ORDER BY created_at, id
    `).all(userId).map(publicAccount);
  }

  getProviderAccountForUser(userId, accountId) {
    required({ userId, accountId });
    const row = this.#db.prepare(`
      SELECT id, provider, external_account_id, display_name, created_at
      FROM provider_accounts
      WHERE id = ? AND user_id = ? AND status = 'active'
    `).get(accountId, userId);
    if (!row) throw new ProviderAccountNotFoundError();
    return publicAccount(row);
  }

  removeProviderAccountForUser(userId, accountId) {
    this.getProviderAccountForUser(userId, accountId);
    this.#db.prepare('DELETE FROM provider_accounts WHERE id = ? AND user_id = ?').run(accountId, userId);
  }

  putCursor({ userId, accountId, provider, cursorType, cursorValue }) {
    required({ userId, accountId, provider, cursorType, cursorValue });
    this.getProviderAccountForUser(userId, accountId);
    const now = new Date().toISOString();
    this.#db.prepare(`
      INSERT INTO sync_cursors
        (user_id, account_id, provider, cursor_type, cursor_value, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, account_id, cursor_type)
      DO UPDATE SET provider = excluded.provider,
                    cursor_value = excluded.cursor_value,
                    updated_at = excluded.updated_at
    `).run(userId, accountId, provider, cursorType, cursorValue, now);
    return this.getCursor({ userId, accountId, cursorType });
  }

  getCursor({ userId, accountId, cursorType }) {
    required({ userId, accountId, cursorType });
    const row = this.#db.prepare(`
      SELECT account_id, provider, cursor_type, cursor_value, updated_at
      FROM sync_cursors
      WHERE user_id = ? AND account_id = ? AND cursor_type = ?
    `).get(userId, accountId, cursorType);
    if (!row) throw new SyncStateNotFoundError();
    return publicCursor(row);
  }

  removeCursor({ userId, accountId, cursorType }) {
    this.getCursor({ userId, accountId, cursorType });
    this.#db.prepare(`
      DELETE FROM sync_cursors
      WHERE user_id = ? AND account_id = ? AND cursor_type = ?
    `).run(userId, accountId, cursorType);
    return { removed: true };
  }

  recordMailboxAttempt({ userId, accountId, mailboxId, errorCode = null, attemptedAt = new Date().toISOString() }) {
    required({ userId, accountId, mailboxId, attemptedAt });
    this.getProviderAccountForUser(userId, accountId);
    this.#db.prepare(`
      INSERT INTO mailbox_cache_state
        (user_id, account_id, mailbox_id, last_successful_sync_at, last_attempted_sync_at, last_error_code)
      VALUES (?, ?, ?, NULL, ?, ?)
      ON CONFLICT(user_id, account_id, mailbox_id)
      DO UPDATE SET last_attempted_sync_at = excluded.last_attempted_sync_at,
                    last_error_code = excluded.last_error_code
    `).run(userId, accountId, mailboxId, attemptedAt, errorCode);
    return this.getMailboxState({ userId, accountId, mailboxId });
  }

  recordMailboxSuccess({ userId, accountId, mailboxId, syncedAt = new Date().toISOString() }) {
    required({ userId, accountId, mailboxId, syncedAt });
    this.getProviderAccountForUser(userId, accountId);
    this.#db.prepare(`
      INSERT INTO mailbox_cache_state
        (user_id, account_id, mailbox_id, last_successful_sync_at, last_attempted_sync_at, last_error_code)
      VALUES (?, ?, ?, ?, ?, NULL)
      ON CONFLICT(user_id, account_id, mailbox_id)
      DO UPDATE SET last_successful_sync_at = excluded.last_successful_sync_at,
                    last_attempted_sync_at = excluded.last_attempted_sync_at,
                    last_error_code = NULL
    `).run(userId, accountId, mailboxId, syncedAt, syncedAt);
    return this.getMailboxState({ userId, accountId, mailboxId });
  }

  getMailboxState({ userId, accountId, mailboxId }) {
    required({ userId, accountId, mailboxId });
    const row = this.#db.prepare(`
      SELECT account_id, mailbox_id, last_successful_sync_at, last_attempted_sync_at, last_error_code
      FROM mailbox_cache_state
      WHERE user_id = ? AND account_id = ? AND mailbox_id = ?
    `).get(userId, accountId, mailboxId);
    if (!row) throw new SyncStateNotFoundError();
    return publicMailbox(row);
  }

  beginIdempotentOperation({ userId, accountId, operation, key, fingerprint }) {
    required({ userId, accountId, operation, key, fingerprint });
    this.getProviderAccountForUser(userId, accountId);
    const prior = this.#idempotencyRow({ userId, accountId, operation, key });
    if (prior) {
      if (prior.request_fingerprint !== fingerprint) throw new IdempotencyConflictError();
      return publicIdempotency(prior);
    }

    const createdAt = new Date().toISOString();
    this.#db.prepare(`
      INSERT INTO operation_idempotency
        (user_id, account_id, operation, idempotency_key, request_fingerprint, status,
         result_json, error_code, created_at, completed_at)
      VALUES (?, ?, ?, ?, ?, 'in-progress', NULL, NULL, ?, NULL)
    `).run(userId, accountId, operation, key, fingerprint, createdAt);
    return this.getIdempotentOperation({ userId, accountId, operation, key });
  }

  completeIdempotentOperation({ userId, accountId, operation, key, result = null }) {
    this.getIdempotentOperation({ userId, accountId, operation, key });
    const completedAt = new Date().toISOString();
    this.#db.prepare(`
      UPDATE operation_idempotency
      SET status = 'completed', result_json = ?, error_code = NULL, completed_at = ?
      WHERE user_id = ? AND account_id = ? AND operation = ? AND idempotency_key = ?
    `).run(JSON.stringify(structuredClone(result)), completedAt, userId, accountId, operation, key);
    return this.getIdempotentOperation({ userId, accountId, operation, key });
  }

  failIdempotentOperation({ userId, accountId, operation, key, errorCode }) {
    required({ errorCode });
    this.getIdempotentOperation({ userId, accountId, operation, key });
    const completedAt = new Date().toISOString();
    this.#db.prepare(`
      UPDATE operation_idempotency
      SET status = 'failed', result_json = NULL, error_code = ?, completed_at = ?
      WHERE user_id = ? AND account_id = ? AND operation = ? AND idempotency_key = ?
    `).run(errorCode, completedAt, userId, accountId, operation, key);
    return this.getIdempotentOperation({ userId, accountId, operation, key });
  }

  getIdempotentOperation({ userId, accountId, operation, key }) {
    required({ userId, accountId, operation, key });
    const row = this.#idempotencyRow({ userId, accountId, operation, key });
    if (!row) throw new IdempotencyNotFoundError();
    return publicIdempotency(row);
  }

  #idempotencyRow({ userId, accountId, operation, key }) {
    return this.#db.prepare(`
      SELECT account_id, operation, idempotency_key, request_fingerprint, status,
             result_json, error_code, created_at, completed_at
      FROM operation_idempotency
      WHERE user_id = ? AND account_id = ? AND operation = ? AND idempotency_key = ?
    `).get(userId, accountId, operation, key);
  }
}
