import { createHash } from 'node:crypto';
import path from 'node:path';

import { requireSessionUser } from './session-context.js';
import { ProviderError, PROVIDER_ERROR_CODES } from '../web/providers/provider-error.js';
import { buildAttachmentResponseHeaders } from './attachment-content-policy.js';
import { storeAttachmentStream, removeStoredAttachment } from './attachment-stream-store.js';

const WARDVEIL_SCAN_CONTRACT_VERSION = '0.1.0';
const WARDVEIL_ATTACHMENT_RESOURCE_TYPE = 'mail_attachment';
const WARDVEIL_SCAN_RESULTS = new Set(['clean', 'suspicious', 'malicious', 'unknown', 'unsupported']);

export const ATTACHMENT_SECURITY_CODES = Object.freeze({
  SCAN_UNAVAILABLE: 'wardveil-scan-unavailable',
  SCAN_INVALID: 'wardveil-scan-invalid',
  SCAN_BLOCKED: 'wardveil-scan-blocked',
  SCAN_HELD: 'wardveil-scan-held',
  SCAN_EXPIRED: 'wardveil-scan-expired',
  SCAN_PROVENANCE_MISSING: 'wardveil-scan-provenance-missing',
  CONTENT_CHANGED: 'wardveil-content-changed',
});

export class AttachmentSecurityError extends ProviderError {
  constructor(message, { code, status = 423, retryable = false, decision = null } = {}) {
    super(message, { code, status, retryable });
    this.name = 'AttachmentSecurityError';
    this.decision = decision ? Object.freeze(structuredClone(decision)) : null;
  }
}

/**
 * Trusted-backend attachment retrieval, Wardveil Scan, and delivery boundary.
 *
 * Provider bytes are fetched only after provider-account ownership is proven by
 * GmailAccountService. The exact bytes are then submitted to Wardveil Scan
 * before any downloadable cache object is committed. Only a current,
 * authoritative, exact-digest clean result may proceed to storage.
 *
 * Stored object IDs remain bound to the authenticated GoreeCloud user and
 * provider account. Browser callers never choose filesystem paths and cannot
 * authorize an attachment by knowing another user's object ID.
 *
 * Wardveil scan provenance is intentionally process-local in this increment.
 * If a durable attachment record survives a process restart without its current
 * scan provenance, download authorization fails closed until the content is
 * retrieved and scanned again. Production acceptance still requires durable,
 * revocable Wardveil evidence or a bounded revalidation path.
 */
export class AttachmentDeliveryService {
  constructor({ gmailAccountService, wardveilScanClient, rootDir, stateStore = null, storeFn = storeAttachmentStream } = {}) {
    if (!gmailAccountService) throw new TypeError('gmailAccountService is required');
    if (!wardveilScanClient || typeof wardveilScanClient.scanAttachment !== 'function') {
      throw new TypeError('wardveilScanClient with scanAttachment is required');
    }
    if (!rootDir) throw new TypeError('rootDir is required');
    if (typeof storeFn !== 'function') throw new TypeError('storeFn is required');
    this.gmailAccountService = gmailAccountService;
    this.wardveilScanClient = wardveilScanClient;
    this.rootDir = rootDir;
    this.stateStore = stateStore;
    this.storeFn = storeFn;
    this.records = new Map();
    this.scanProvenance = new Map();
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
    const providerBytes = asBuffer(providerAttachment.bytes);
    const resourceId = `mail:${String(messageId)}:attachment:${String(attachmentId)}`;
    const expectedDigest = createHash('sha256').update(providerBytes).digest('hex');

    let scanEnvelope;
    try {
      scanEnvelope = await this.wardveilScanClient.scanAttachment({
        messageId: String(messageId),
        attachmentId: String(attachmentId),
        bytes: providerBytes,
        action: 'download',
      });
    } catch (error) {
      if (error instanceof AttachmentSecurityError) throw error;
      throw securityError('Wardveil Scan is currently unavailable for this attachment.', {
        code: ATTACHMENT_SECURITY_CODES.SCAN_UNAVAILABLE,
        status: 503,
        retryable: true,
        decision: blockedDecision('blocked_unverified', 'wardveil_scan_unavailable'),
        cause: error,
      });
    }

    const scan = requireCurrentCleanScan(scanEnvelope, {
      resourceId,
      digestSha256: expectedDigest,
      now,
    });

    const normalizedMetadata = {
      ...metadata,
      size: providerAttachment.size,
    };

    const stored = await this.storeFn({
      rootDir: this.rootDir,
      metadata: normalizedMetadata,
      maxBytes,
      source: singleChunk(providerBytes),
    });

    if (stored.sha256 !== expectedDigest || stored.sha256 !== scan.digestSha256) {
      await removeStoredAttachment({ rootDir: this.rootDir, objectId: stored.objectId }).catch(() => {});
      throw securityError('Attachment content changed after Wardveil Scan validation.', {
        code: ATTACHMENT_SECURITY_CODES.CONTENT_CHANGED,
        decision: blockedDecision('blocked_unverified', 'content_changed_after_scan'),
      });
    }

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
      this.scanProvenance.set(stored.objectId, scan);
    } catch (error) {
      this.scanProvenance.delete(stored.objectId);
      await removeStoredAttachment({ rootDir: this.rootDir, objectId: stored.objectId }).catch(() => {});
      throw error;
    }

    return publicRecord(record, scan);
  }

  authorizeDownload({ session, objectId, now = Date.now() } = {}) {
    const { userId } = requireSessionUser(session);
    const record = this.#ownedRecord(userId, objectId);
    if (record.expiresAt && Date.parse(record.expiresAt) <= now) throw notFound();

    const scan = this.scanProvenance.get(record.objectId);
    if (!scan) {
      throw securityError('Current Wardveil Scan provenance is required before this attachment can be downloaded.', {
        code: ATTACHMENT_SECURITY_CODES.SCAN_PROVENANCE_MISSING,
        decision: blockedDecision('blocked_unverified', 'wardveil_scan_provenance_missing'),
      });
    }
    requirePersistedCleanScan(scan, { storedDigest: record.sha256 ?? record.stored?.sha256, now });

    if (this.stateStore) {
      this.stateStore.touchAttachmentDeliveryRecord({
        userId,
        objectId: record.objectId,
        accessedAt: new Date(now).toISOString(),
      });
    }

    return Object.freeze({
      ...publicRecord(record, scan),
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
    this.scanProvenance.delete(record.objectId);
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
      this.scanProvenance.delete(record.objectId);
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

function requireCurrentCleanScan(envelope, { resourceId, digestSha256, now }) {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    throw invalidScan('invalid_scan_envelope');
  }
  if (envelope.resource_id !== resourceId || String(envelope.resource_digest_sha256 ?? '').toLowerCase() !== digestSha256) {
    throw invalidScan('scan_resource_binding_mismatch');
  }

  const record = envelope.scan_record;
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw invalidScan('invalid_scan_record');
  if (Object.hasOwn(record, 'scan_result')) throw invalidScan('obsolete_scan_result_field');
  if (record.contract_version !== WARDVEIL_SCAN_CONTRACT_VERSION || record.record_type !== 'scan_finding') {
    throw invalidScan('unsupported_scan_contract');
  }
  if (!record.producer || record.producer.authoritative !== true || typeof record.producer.id !== 'string' || !record.producer.id) {
    throw invalidScan('non_authoritative_scan_record');
  }
  if (!record.scope || record.scope.resource_type !== WARDVEIL_ATTACHMENT_RESOURCE_TYPE || record.scope.resource_id !== resourceId) {
    throw invalidScan('scan_scope_mismatch');
  }
  if (!WARDVEIL_SCAN_RESULTS.has(record.result)) throw invalidScan('unsupported_scan_result');
  if (typeof record.record_id !== 'string' || !record.record_id || typeof record.correlation_id !== 'string' || !record.correlation_id) {
    throw invalidScan('missing_scan_identity');
  }
  if (!Array.isArray(record.evidence_refs) || record.evidence_refs.length === 0 || record.evidence_refs.some((ref) => typeof ref !== 'string' || !ref)) {
    throw invalidScan('missing_scan_evidence');
  }

  const observedAt = parseInstant(record.observed_at);
  const validUntil = parseInstant(record.valid_until);
  if (observedAt > now || validUntil <= observedAt) throw invalidScan('invalid_scan_evidence_time');

  if (record.result === 'malicious') {
    throw securityError('Wardveil blocked this attachment because current evidence identifies malicious content.', {
      code: ATTACHMENT_SECURITY_CODES.SCAN_BLOCKED,
      decision: blockedDecision('block_quarantine', 'wardveil_scan_malicious', record, true),
    });
  }
  if (record.result === 'suspicious') {
    throw securityError('Wardveil is holding this attachment for security review.', {
      code: ATTACHMENT_SECURITY_CODES.SCAN_HELD,
      decision: blockedDecision('hold_review', 'wardveil_scan_suspicious', record, false),
    });
  }
  if (record.result === 'unknown' || record.result === 'unsupported') {
    throw securityError('Wardveil could not establish a clean result for this attachment.', {
      code: ATTACHMENT_SECURITY_CODES.SCAN_INVALID,
      status: 503,
      retryable: record.result === 'unknown',
      decision: blockedDecision('blocked_unverified', `wardveil_scan_${record.result}`, record, false),
    });
  }
  if (validUntil <= now) {
    throw securityError('Wardveil Scan evidence for this attachment is no longer current.', {
      code: ATTACHMENT_SECURITY_CODES.SCAN_EXPIRED,
      decision: blockedDecision('blocked_unverified', 'clean_scan_evidence_expired', record, false),
    });
  }

  return Object.freeze({
    result: 'clean',
    recordId: record.record_id,
    correlationId: record.correlation_id,
    producerId: record.producer.id,
    observedAt: record.observed_at,
    validUntil: record.valid_until,
    digestSha256,
    evidenceRefs: Object.freeze([...record.evidence_refs]),
  });
}

function requirePersistedCleanScan(scan, { storedDigest, now }) {
  if (!scan || scan.result !== 'clean' || !scan.recordId || !scan.producerId || !Array.isArray(scan.evidenceRefs) || scan.evidenceRefs.length === 0) {
    throw invalidScan('stored_scan_provenance_invalid');
  }
  if (scan.digestSha256 !== storedDigest) {
    throw securityError('Attachment content no longer matches its Wardveil Scan evidence.', {
      code: ATTACHMENT_SECURITY_CODES.CONTENT_CHANGED,
      decision: blockedDecision('blocked_unverified', 'stored_content_digest_mismatch'),
    });
  }
  const observedAt = parseInstant(scan.observedAt);
  const validUntil = parseInstant(scan.validUntil);
  if (observedAt > now || validUntil <= observedAt) throw invalidScan('stored_scan_evidence_time_invalid');
  if (validUntil <= now) {
    throw securityError('Wardveil Scan evidence for this attachment is no longer current.', {
      code: ATTACHMENT_SECURITY_CODES.SCAN_EXPIRED,
      decision: blockedDecision('blocked_unverified', 'clean_scan_evidence_expired'),
    });
  }
  return true;
}

function parseInstant(value) {
  if (typeof value !== 'string' || !value) throw invalidScan('missing_scan_timestamp');
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw invalidScan('invalid_scan_timestamp');
  return parsed;
}

function invalidScan(reason) {
  return securityError('Wardveil Scan evidence for this attachment is invalid.', {
    code: ATTACHMENT_SECURITY_CODES.SCAN_INVALID,
    status: 503,
    decision: blockedDecision('blocked_unverified', reason),
  });
}

function blockedDecision(disposition, reasonCode, record = null, quarantineRequired = false) {
  return {
    disposition,
    canOpen: false,
    canDownload: false,
    quarantineRequired,
    reasonCodes: [reasonCode],
    scanRecordId: typeof record?.record_id === 'string' ? record.record_id : null,
    evidenceRefs: Array.isArray(record?.evidence_refs) ? record.evidence_refs.filter((ref) => typeof ref === 'string' && ref) : [],
  };
}

function securityError(message, { code, status = 423, retryable = false, decision = null, cause = null } = {}) {
  const error = new AttachmentSecurityError(message, { code, status, retryable, decision });
  if (cause) error.cause = cause;
  return error;
}

function publicRecord(record, scan = null) {
  const wardveil = scan ? Object.freeze({
    result: scan.result,
    scanRecordId: scan.recordId,
    correlationId: scan.correlationId,
    producerId: scan.producerId,
    observedAt: scan.observedAt,
    validUntil: scan.validUntil,
    evidenceRefs: Object.freeze([...scan.evidenceRefs]),
  }) : null;

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
      wardveil,
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
    wardveil,
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

function asBuffer(bytes) {
  if (Buffer.isBuffer(bytes)) return Buffer.from(bytes);
  if (bytes instanceof Uint8Array) return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  throw new TypeError('provider attachment bytes must be Buffer or Uint8Array');
}

async function* singleChunk(bytes) {
  yield bytes;
}
