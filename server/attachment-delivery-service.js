import path from 'node:path';

import { requireSessionUser } from './session-context.js';
import { ProviderError, PROVIDER_ERROR_CODES } from '../web/providers/provider-error.js';
import { buildAttachmentResponseHeaders } from './attachment-content-policy.js';
import { storeAttachmentStream, removeStoredAttachment } from './attachment-stream-store.js';

/**
 * Trusted-backend attachment retrieval and delivery boundary.
 *
 * Provider bytes are fetched only after provider-account ownership is proven by
 * GmailAccountService. Stored object IDs are then bound to the authenticated
 * GoreeCloud user and provider account. Browser callers never choose filesystem
 * paths and cannot authorize an attachment by knowing another user's object ID.
 *
 * When a durable stateStore is supplied, metadata survives process restart and
 * expiry cleanup coordinates stored bytes with SQLite metadata. Without one,
 * the service intentionally falls back to process-local development state.
 */
export class AttachmentDeliveryService {
  constructor({ gmailAccountService, rootDir, stateStore = null, storeFn = storeAttachmentStream } = {}) {
    if (!gmailAccountService) throw new TypeError('gmailAccountService is required');
    if (!rootDir) throw new TypeError('rootDir is required');
    if (typeof storeFn !== 'function') throw new TypeError('storeFn is required');
    this.gmailAccountService = gmailAccountService;
    this.rootDir = rootDir;
    this.stateStore = stateStore;
    this.storeFn = storeFn;
    this.records = new Map();
  }

  async retrieveGmailAttachment({ session, accountId, messageId, attachmentId, metadata = {}, maxBytes, ttlMs = null, now = Date.now() } = {}) {
    const { userId } = requireSessionUser(session);
    if (ttlMs !== null && (!Number.isFinite(ttlMs) || ttlMs <= 0)) throw new TypeError('ttlMs must be positive when provided');

    const providerAttachment = await this.gmailAccountService.getAttachment({
      session,
      accountId,
      messageId,
      attachmentId,
      maxBytes,
    });

    const normalizedMetadata = {
      ...metadata,
      size: providerAttachment.size,
    };

    const stored = await this.storeFn({
      rootDir: this.rootDir,
      metadata: normalizedMetadata,
      maxBytes,
      source: singleChunk(providerAttachment.bytes),
    });

    const createdAt = new Date(now).toISOString();
    const expiresAt = ttlMs === null ? null : new Date(now + ttlMs).toISOString();
    const record = Object.freeze({
      objectId: stored.objectId,
      userId,
      accountId: String(accountId),
      messageId: String(messageId),
      attachmentId: String(attachmentId),
      metadata: Object.freeze({ ...normalizedMetadata }),
      stored,
      createdAt,
      expiresAt,
    });

    try {
      if (this.stateStore) {
        this.stateStore.putAttachmentDeliveryRecord({
          userId,
          accountId: record.accountId,
          objectId: stored.objectId,
          messageId: record.messageId,
          attachmentId: record.attachmentId,
          filename: String(normalizedMetadata.filename || 'attachment'),
          mimeType: String(normalizedMetadata.mimeType || 'application/octet-stream'),
          sniffedMimeType: stored.sniffedMimeType,
          size: stored.actualSize,
          sha256: stored.sha256,
          createdAt,
          expiresAt,
        });
      } else {
        this.records.set(stored.objectId, record);
      }
    } catch (error) {
      await removeStoredAttachment({ rootDir: this.rootDir, objectId: stored.objectId }).catch(() => {});
      throw error;
    }

    return publicRecord(record);
  }

  authorizeDownload({ session, objectId, now = Date.now() } = {}) {
    const { userId } = requireSessionUser(session);
    const record = this.#ownedRecord(userId, objectId);
    if (record.expiresAt && Date.parse(record.expiresAt) <= now) throw notFound();

    if (this.stateStore) {
      this.stateStore.touchAttachmentDeliveryRecord({
        userId,
        objectId: record.objectId,
        accessedAt: new Date(now).toISOString(),
      });
    }

    return Object.freeze({
      ...publicRecord(record),
      path: storedPath(this.rootDir, record.objectId),
      headers: buildAttachmentResponseHeaders(record.metadata ?? {
        filename: record.filename,
        mimeType: record.mimeType,
        size: record.size,
      }, {
        attachment: undefined,
        previewAllowed: false,
      }),
    });
  }

  async remove({ session, objectId } = {}) {
    const { userId } = requireSessionUser(session);
    const record = this.#ownedRecord(userId, objectId);
    await removeStoredAttachment({ rootDir: this.rootDir, objectId: record.objectId });
    if (this.stateStore) this.stateStore.removeAttachmentDeliveryRecord({ userId, objectId: record.objectId });
    else this.records.delete(record.objectId);
    return true;
  }

  async cleanupExpired({ now = Date.now(), limit = 100 } = {}) {
    if (!this.stateStore) return Object.freeze({ removed: 0, remaining: 0 });
    const nowIso = new Date(now).toISOString();
    const expired = this.stateStore.listExpiredAttachmentDeliveryRecords({ now: nowIso, limit });
    let removed = 0;

    for (const record of expired) {
      await removeStoredAttachment({ rootDir: this.rootDir, objectId: record.objectId });
      this.stateStore.removeAttachmentDeliveryRecord({ userId: record.userId, objectId: record.objectId });
      removed += 1;
    }

    const remaining = this.stateStore.listExpiredAttachmentDeliveryRecords({ now: nowIso, limit: 1 }).length;
    return Object.freeze({ removed, remaining });
  }

  #ownedRecord(userId, objectId) {
    const normalizedObjectId = String(objectId ?? '');
    try {
      if (this.stateStore) return this.stateStore.getAttachmentDeliveryRecord({ userId, objectId: normalizedObjectId });
      const record = this.records.get(normalizedObjectId);
      if (!record || record.userId !== userId) throw new Error('not found');
      return record;
    } catch {
      throw notFound();
    }
  }
}

function publicRecord(record) {
  if (record.stored) {
    return Object.freeze({
      objectId: record.objectId,
      accountId: record.accountId,
      messageId: record.messageId,
      attachmentId: record.attachmentId,
      filename: String(record.metadata.filename || 'attachment'),
      mimeType: String(record.metadata.mimeType || 'application/octet-stream'),
      size: record.stored.actualSize,
      sha256: record.stored.sha256,
      sniffedMimeType: record.stored.sniffedMimeType,
      expiresAt: record.expiresAt ?? null,
    });
  }
  return Object.freeze({
    objectId: record.objectId,
    accountId: record.accountId,
    messageId: record.messageId,
    attachmentId: record.attachmentId,
    filename: record.filename,
    mimeType: record.mimeType,
    size: record.size,
    sha256: record.sha256,
    sniffedMimeType: record.sniffedMimeType,
    expiresAt: record.expiresAt ?? null,
  });
}

function storedPath(rootDir, objectId) {
  if (!/^[A-Za-z0-9._-]+$/.test(String(objectId ?? ''))) throw notFound();
  return path.join(rootDir, String(objectId));
}

function notFound() {
  return new ProviderError('The requested attachment was not found.', {
    code: PROVIDER_ERROR_CODES.NOT_FOUND,
    status: 404,
  });
}

async function* singleChunk(bytes) {
  yield bytes;
}
