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
 * This registry is process-local development state. Durable attachment metadata
 * remains a later persistence milestone.
 */
export class AttachmentDeliveryService {
  constructor({ gmailAccountService, rootDir, storeFn = storeAttachmentStream } = {}) {
    if (!gmailAccountService) throw new TypeError('gmailAccountService is required');
    if (!rootDir) throw new TypeError('rootDir is required');
    if (typeof storeFn !== 'function') throw new TypeError('storeFn is required');
    this.gmailAccountService = gmailAccountService;
    this.rootDir = rootDir;
    this.storeFn = storeFn;
    this.records = new Map();
  }

  async retrieveGmailAttachment({ session, accountId, messageId, attachmentId, metadata = {}, maxBytes } = {}) {
    const { userId } = requireSessionUser(session);
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

    const record = Object.freeze({
      userId,
      accountId: String(accountId),
      messageId: String(messageId),
      attachmentId: String(attachmentId),
      metadata: Object.freeze({ ...normalizedMetadata }),
      stored,
    });
    this.records.set(stored.objectId, record);
    return publicRecord(record);
  }

  authorizeDownload({ session, objectId } = {}) {
    const { userId } = requireSessionUser(session);
    const record = this.#ownedRecord(userId, objectId);
    return Object.freeze({
      ...publicRecord(record),
      path: record.stored.path,
      headers: buildAttachmentResponseHeaders(record.metadata, {
        attachment: undefined,
        previewAllowed: false,
      }),
    });
  }

  async remove({ session, objectId } = {}) {
    const { userId } = requireSessionUser(session);
    const record = this.#ownedRecord(userId, objectId);
    await removeStoredAttachment({ rootDir: this.rootDir, objectId: record.stored.objectId });
    this.records.delete(record.stored.objectId);
    return true;
  }

  #ownedRecord(userId, objectId) {
    const record = this.records.get(String(objectId ?? ''));
    if (!record || record.userId !== userId) {
      throw new ProviderError('The requested attachment was not found.', {
        code: PROVIDER_ERROR_CODES.NOT_FOUND,
        status: 404,
      });
    }
    return record;
  }
}

function publicRecord(record) {
  return Object.freeze({
    objectId: record.stored.objectId,
    accountId: record.accountId,
    messageId: record.messageId,
    attachmentId: record.attachmentId,
    filename: String(record.metadata.filename || 'attachment'),
    mimeType: String(record.metadata.mimeType || 'application/octet-stream'),
    size: record.stored.actualSize,
    sha256: record.stored.sha256,
    sniffedMimeType: record.stored.sniffedMimeType,
  });
}

async function* singleChunk(bytes) {
  yield bytes;
}
