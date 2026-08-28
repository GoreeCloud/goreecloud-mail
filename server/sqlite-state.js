import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import { ProviderAccountNotFoundError } from './provider-account-registry.js';
import { SyncStateNotFoundError } from './sync-state-store.js';
import { IdempotencyConflictError, IdempotencyNotFoundError } from './idempotency-store.js';
import { OAuthStateError, isApprovedRedirectPath } from './oauth-state-store.js';
import { CredentialNotFoundError } from './credential-vault.js';
import { applySqliteMigrations } from './sqlite-migrations.js';

const ATTACHMENT_NOT_FOUND = 'Attachment delivery record was not found.';

function required(values) {
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === '') throw new TypeError(`${name} is required`);
  }
}

function publicAccount(row) {
  return Object.freeze({ id: row.id, provider: row.provider, externalAccountId: row.external_account_id ?? null, displayName: row.display_name ?? null, createdAt: row.created_at });
}
function publicCursor(row) {
  return Object.freeze({ accountId: row.account_id, provider: row.provider, cursorType: row.cursor_type, cursorValue: row.cursor_value, updatedAt: row.updated_at });
}
function publicMailbox(row) {
  return Object.freeze({ accountId: row.account_id, mailboxId: row.mailbox_id, lastSuccessfulSyncAt: row.last_successful_sync_at ?? null, lastAttemptedSyncAt: row.last_attempted_sync_at ?? null, lastErrorCode: row.last_error_code ?? null });
}
function parseResult(value) {
  if (value === null || value === undefined) return null;
  return structuredClone(JSON.parse(value));
}
function publicIdempotency(row) {
  return Object.freeze({ accountId: row.account_id, operation: row.operation, key: row.idempotency_key, status: row.status, result: parseResult(row.result_json), errorCode: row.error_code ?? null, createdAt: row.created_at, completedAt: row.completed_at ?? null });
}
function publicCredentialRef(row) {
  return Object.freeze({ accountId: row.account_id, provider: row.provider, updatedAt: row.updated_at, configured: true });
}
function publicAttachment(row) {
  return Object.freeze({
    objectId: row.object_id,
    accountId: row.account_id,
    messageId: row.message_id,
    attachmentId: row.attachment_id,
    filename: row.filename,
    mimeType: row.declared_mime_type,
    sniffedMimeType: row.sniffed_mime_type ?? null,
    size: Number(row.actual_size),
    sha256: row.sha256,
    createdAt: row.created_at,
    lastAccessedAt: row.last_accessed_at ?? null,
    expiresAt: row.expires_at ?? null,
  });
}
function hashOAuthState(state) {
  return createHash('sha256').update(state, 'utf8').digest('hex');
}

/** Durable GoreeCloud Mail application-state store backed by SQLite. */
export class SqliteMailState {
  #db;

  constructor({ path = ':memory:' } = {}) {
    this.#db = new DatabaseSync(path);
    this.#db.exec('PRAGMA foreign_keys = ON;');
    this.#db.exec('PRAGMA journal_mode = WAL;');
    applySqliteMigrations(this.#db);
  }
  close() { this.#db.close(); }
  transaction(callback) {
    if (typeof callback !== 'function') throw new TypeError('callback is required');
    this.#db.exec('BEGIN IMMEDIATE;');
    try { const result = callback(this); this.#db.exec('COMMIT;'); return result; }
    catch (error) { this.#db.exec('ROLLBACK;'); throw error; }
  }

  createProviderAccount({ userId, provider, externalAccountId = null, displayName = null }) {
    required({ userId, provider });
    const id = randomUUID(); const now = new Date().toISOString();
    this.#db.prepare(`INSERT INTO provider_accounts (id,user_id,provider,external_account_id,display_name,status,created_at,updated_at) VALUES (?,?,?,?,?,'active',?,?)`).run(id,userId,provider,externalAccountId,displayName,now,now);
    return this.getProviderAccountForUser(userId,id);
  }
  listProviderAccountsForUser(userId) {
    required({ userId });
    return this.#db.prepare(`SELECT id,provider,external_account_id,display_name,created_at FROM provider_accounts WHERE user_id=? AND status='active' ORDER BY created_at,id`).all(userId).map(publicAccount);
  }
  getProviderAccountForUser(userId, accountId) {
    required({ userId, accountId });
    const row = this.#db.prepare(`SELECT id,provider,external_account_id,display_name,created_at FROM provider_accounts WHERE id=? AND user_id=? AND status='active'`).get(accountId,userId);
    if (!row) throw new ProviderAccountNotFoundError(); return publicAccount(row);
  }
  removeProviderAccountForUser(userId, accountId) {
    this.getProviderAccountForUser(userId,accountId);
    this.#db.prepare('DELETE FROM provider_accounts WHERE id=? AND user_id=?').run(accountId,userId);
  }

  putCredentialRef({ userId, accountId, provider, vaultKey }) {
    required({ userId, accountId, provider, vaultKey });
    const account = this.getProviderAccountForUser(userId, accountId);
    if (account.provider !== provider) throw new TypeError('provider must match the provider account');
    const now = new Date().toISOString();
    this.#db.prepare(`INSERT INTO provider_credential_refs (user_id,account_id,provider,vault_key,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(user_id,account_id) DO UPDATE SET provider=excluded.provider,vault_key=excluded.vault_key,updated_at=excluded.updated_at`).run(userId,accountId,provider,vaultKey,now);
    return this.describeCredentialRef({ userId, accountId });
  }
  getCredentialVaultKey({ userId, accountId }) {
    required({ userId, accountId }); const row = this.#credentialRefRow({ userId, accountId });
    if (!row) throw new CredentialNotFoundError(); return row.vault_key;
  }
  describeCredentialRef({ userId, accountId }) {
    required({ userId, accountId }); const row = this.#credentialRefRow({ userId, accountId });
    if (!row) throw new CredentialNotFoundError(); return publicCredentialRef(row);
  }
  removeCredentialRef({ userId, accountId }) {
    this.describeCredentialRef({ userId, accountId });
    this.#db.prepare('DELETE FROM provider_credential_refs WHERE user_id=? AND account_id=?').run(userId,accountId);
    return { removed: true };
  }

  issueOAuthState({ userId, provider, redirectPath='/', pkceVerifierRef=null, ttlMs=10*60*1000, now=Date.now() }) {
    required({ userId, provider });
    if (!isApprovedRedirectPath(redirectPath)) throw new TypeError('redirectPath must be an application-relative path');
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new TypeError('ttlMs must be positive');
    const state = randomBytes(32).toString('base64url');
    this.#db.prepare(`INSERT INTO oauth_authorization_state (state_hash,user_id,provider,redirect_path,pkce_verifier_ref,expires_at,consumed_at) VALUES (?,?,?,?,?,?,NULL)`).run(hashOAuthState(state),userId,provider,redirectPath,pkceVerifierRef,new Date(now+ttlMs).toISOString());
    return state;
  }
  consumeOAuthState({ state, userId, provider, now=Date.now() }) {
    required({ state, userId, provider }); const stateHash=hashOAuthState(state);
    const row=this.#db.prepare(`SELECT state_hash,user_id,provider,redirect_path,pkce_verifier_ref,expires_at,consumed_at FROM oauth_authorization_state WHERE state_hash=?`).get(stateHash);
    if (!row || row.consumed_at || Date.parse(row.expires_at) <= now) throw new OAuthStateError();
    if (row.user_id !== userId || row.provider !== provider) throw new OAuthStateError();
    this.#db.prepare(`UPDATE oauth_authorization_state SET consumed_at=? WHERE state_hash=? AND consumed_at IS NULL`).run(new Date(now).toISOString(),stateHash);
    return Object.freeze({ redirectPath: row.redirect_path, pkceVerifierRef: row.pkce_verifier_ref ?? null });
  }
  purgeExpiredOAuthStates({ now=Date.now() }={}) {
    const result=this.#db.prepare('DELETE FROM oauth_authorization_state WHERE expires_at<=?').run(new Date(now).toISOString());
    return { removed: Number(result.changes) };
  }

  putCursor({ userId, accountId, provider, cursorType, cursorValue }) {
    required({ userId,accountId,provider,cursorType,cursorValue }); this.getProviderAccountForUser(userId,accountId); const now=new Date().toISOString();
    this.#db.prepare(`INSERT INTO sync_cursors (user_id,account_id,provider,cursor_type,cursor_value,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(user_id,account_id,cursor_type) DO UPDATE SET provider=excluded.provider,cursor_value=excluded.cursor_value,updated_at=excluded.updated_at`).run(userId,accountId,provider,cursorType,cursorValue,now);
    return this.getCursor({ userId,accountId,cursorType });
  }
  getCursor({ userId,accountId,cursorType }) {
    required({ userId,accountId,cursorType }); const row=this.#db.prepare(`SELECT account_id,provider,cursor_type,cursor_value,updated_at FROM sync_cursors WHERE user_id=? AND account_id=? AND cursor_type=?`).get(userId,accountId,cursorType);
    if (!row) throw new SyncStateNotFoundError(); return publicCursor(row);
  }
  removeCursor({ userId,accountId,cursorType }) { this.getCursor({userId,accountId,cursorType}); this.#db.prepare('DELETE FROM sync_cursors WHERE user_id=? AND account_id=? AND cursor_type=?').run(userId,accountId,cursorType); return {removed:true}; }
  recordMailboxAttempt({ userId,accountId,mailboxId,errorCode=null,attemptedAt=new Date().toISOString() }) {
    required({userId,accountId,mailboxId,attemptedAt}); this.getProviderAccountForUser(userId,accountId);
    this.#db.prepare(`INSERT INTO mailbox_cache_state (user_id,account_id,mailbox_id,last_successful_sync_at,last_attempted_sync_at,last_error_code) VALUES (?,?,?,NULL,?,?) ON CONFLICT(user_id,account_id,mailbox_id) DO UPDATE SET last_attempted_sync_at=excluded.last_attempted_sync_at,last_error_code=excluded.last_error_code`).run(userId,accountId,mailboxId,attemptedAt,errorCode); return this.getMailboxState({userId,accountId,mailboxId});
  }
  recordMailboxSuccess({userId,accountId,mailboxId,syncedAt=new Date().toISOString()}) {
    required({userId,accountId,mailboxId,syncedAt}); this.getProviderAccountForUser(userId,accountId);
    this.#db.prepare(`INSERT INTO mailbox_cache_state (user_id,account_id,mailbox_id,last_successful_sync_at,last_attempted_sync_at,last_error_code) VALUES (?,?,?,?,?,NULL) ON CONFLICT(user_id,account_id,mailbox_id) DO UPDATE SET last_successful_sync_at=excluded.last_successful_sync_at,last_attempted_sync_at=excluded.last_attempted_sync_at,last_error_code=NULL`).run(userId,accountId,mailboxId,syncedAt,syncedAt); return this.getMailboxState({userId,accountId,mailboxId});
  }
  getMailboxState({userId,accountId,mailboxId}) {
    required({userId,accountId,mailboxId}); const row=this.#db.prepare(`SELECT account_id,mailbox_id,last_successful_sync_at,last_attempted_sync_at,last_error_code FROM mailbox_cache_state WHERE user_id=? AND account_id=? AND mailbox_id=?`).get(userId,accountId,mailboxId); if(!row) throw new SyncStateNotFoundError(); return publicMailbox(row);
  }

  putAttachmentDeliveryRecord({ userId, accountId, objectId, messageId, attachmentId, filename='attachment', mimeType='application/octet-stream', sniffedMimeType=null, size, sha256, createdAt=new Date().toISOString(), expiresAt=null }) {
    required({ userId, accountId, objectId, messageId, attachmentId, filename, mimeType, size, sha256, createdAt });
    this.getProviderAccountForUser(userId, accountId);
    if (!Number.isSafeInteger(Number(size)) || Number(size) < 0) throw new TypeError('size must be a non-negative safe integer');
    this.#db.prepare(`INSERT INTO attachment_delivery_records (object_id,user_id,account_id,message_id,attachment_id,filename,declared_mime_type,sniffed_mime_type,actual_size,sha256,created_at,last_accessed_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,NULL,?)`).run(objectId,userId,accountId,messageId,attachmentId,filename,mimeType,sniffedMimeType,Number(size),sha256,createdAt,expiresAt);
    return this.getAttachmentDeliveryRecord({ userId, objectId });
  }
  getAttachmentDeliveryRecord({ userId, objectId }) {
    required({ userId, objectId });
    const row=this.#db.prepare(`SELECT object_id,account_id,message_id,attachment_id,filename,declared_mime_type,sniffed_mime_type,actual_size,sha256,created_at,last_accessed_at,expires_at FROM attachment_delivery_records WHERE user_id=? AND object_id=?`).get(userId,objectId);
    if (!row) throw new SyncStateNotFoundError(ATTACHMENT_NOT_FOUND);
    return publicAttachment(row);
  }
  touchAttachmentDeliveryRecord({ userId, objectId, accessedAt=new Date().toISOString() }) {
    required({ userId, objectId, accessedAt }); this.getAttachmentDeliveryRecord({ userId, objectId });
    this.#db.prepare('UPDATE attachment_delivery_records SET last_accessed_at=? WHERE user_id=? AND object_id=?').run(accessedAt,userId,objectId);
    return this.getAttachmentDeliveryRecord({ userId, objectId });
  }
  removeAttachmentDeliveryRecord({ userId, objectId }) {
    this.getAttachmentDeliveryRecord({ userId, objectId });
    this.#db.prepare('DELETE FROM attachment_delivery_records WHERE user_id=? AND object_id=?').run(userId,objectId);
    return { removed: true };
  }
  listExpiredAttachmentDeliveryRecords({ now=new Date().toISOString(), limit=100 }={}) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new TypeError('limit must be an integer between 1 and 1000');
    return this.#db.prepare(`SELECT object_id,user_id,account_id,message_id,attachment_id,filename,declared_mime_type,sniffed_mime_type,actual_size,sha256,created_at,last_accessed_at,expires_at FROM attachment_delivery_records WHERE expires_at IS NOT NULL AND expires_at<=? ORDER BY expires_at,object_id LIMIT ?`).all(now,limit).map((row) => Object.freeze({ userId: row.user_id, ...publicAttachment(row) }));
  }

  beginIdempotentOperation({userId,accountId,operation,key,fingerprint}) {
    required({userId,accountId,operation,key,fingerprint}); this.getProviderAccountForUser(userId,accountId); const prior=this.#idempotencyRow({userId,accountId,operation,key}); if(prior){if(prior.request_fingerprint!==fingerprint) throw new IdempotencyConflictError(); return publicIdempotency(prior);} const createdAt=new Date().toISOString();
    this.#db.prepare(`INSERT INTO operation_idempotency (user_id,account_id,operation,idempotency_key,request_fingerprint,status,result_json,error_code,created_at,completed_at) VALUES (?,?,?,?,?,'in-progress',NULL,NULL,?,NULL)`).run(userId,accountId,operation,key,fingerprint,createdAt); return this.getIdempotentOperation({userId,accountId,operation,key});
  }
  completeIdempotentOperation({userId,accountId,operation,key,result=null}) { this.getIdempotentOperation({userId,accountId,operation,key}); const completedAt=new Date().toISOString(); this.#db.prepare(`UPDATE operation_idempotency SET status='completed',result_json=?,error_code=NULL,completed_at=? WHERE user_id=? AND account_id=? AND operation=? AND idempotency_key=?`).run(JSON.stringify(structuredClone(result)),completedAt,userId,accountId,operation,key); return this.getIdempotentOperation({userId,accountId,operation,key}); }
  failIdempotentOperation({userId,accountId,operation,key,errorCode}) { required({errorCode}); this.getIdempotentOperation({userId,accountId,operation,key}); const completedAt=new Date().toISOString(); this.#db.prepare(`UPDATE operation_idempotency SET status='failed',result_json=NULL,error_code=?,completed_at=? WHERE user_id=? AND account_id=? AND operation=? AND idempotency_key=?`).run(errorCode,completedAt,userId,accountId,operation,key); return this.getIdempotentOperation({userId,accountId,operation,key}); }
  getIdempotentOperation({userId,accountId,operation,key}) { required({userId,accountId,operation,key}); const row=this.#idempotencyRow({userId,accountId,operation,key}); if(!row) throw new IdempotencyNotFoundError(); return publicIdempotency(row); }

  #credentialRefRow({userId,accountId}) { return this.#db.prepare(`SELECT account_id,provider,vault_key,updated_at FROM provider_credential_refs WHERE user_id=? AND account_id=?`).get(userId,accountId); }
  #idempotencyRow({userId,accountId,operation,key}) { return this.#db.prepare(`SELECT account_id,operation,idempotency_key,request_fingerprint,status,result_json,error_code,created_at,completed_at FROM operation_idempotency WHERE user_id=? AND account_id=? AND operation=? AND idempotency_key=?`).get(userId,accountId,operation,key); }
}
