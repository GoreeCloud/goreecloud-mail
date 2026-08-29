import { createHash } from 'node:crypto';

import {
  ATTACHMENT_SECURITY_CODES,
  AttachmentSecurityError,
} from './attachment-delivery-service.js';
import { buildGmailRawMessage } from './gmail-message-builder.js';
import { persistOutgoingWardveilScanProvenance } from './outgoing-attachment-scan-provenance-store.js';

const WARDVEIL_SCAN_CONTRACT_VERSION = '0.1.0';
const WARDVEIL_ATTACHMENT_RESOURCE_TYPE = 'mail_attachment';

/**
 * Fail-closed Wardveil boundary for Gmail outgoing attachment writes.
 *
 * The existing Gmail MIME builder is invoked first as the single validation authority for the
 * complete message and attachment limits. Only after that validation succeeds are the exact input
 * attachment bytes materialized, submitted to Wardveil Scan, and replaced with immutable Buffers.
 * GmailAccountService serializes those same Buffers into the provider write, preventing a
 * scan-one-representation/send-another gap.
 *
 * Minimized clean scan provenance is durably persisted before this gate returns an authorized
 * attachment message. A persistence failure therefore blocks Gmail client creation/provider write.
 * This application provenance is not Wardveil Audit and does not establish production acceptance.
 */
export class GmailOutgoingAttachmentSecurityGate {
  constructor({
    wardveilScanClient,
    provenanceRootDir,
    persistProvenanceFn = persistOutgoingWardveilScanProvenance,
  } = {}) {
    if (!wardveilScanClient || typeof wardveilScanClient.scan !== 'function') {
      throw new TypeError('wardveilScanClient with scan is required');
    }
    if (!provenanceRootDir) throw new TypeError('provenanceRootDir is required');
    if (typeof persistProvenanceFn !== 'function') throw new TypeError('persistProvenanceFn must be a function');
    this.wardveilScanClient = wardveilScanClient;
    this.provenanceRootDir = provenanceRootDir;
    this.persistProvenanceFn = persistProvenanceFn;
  }

  async authorize({ accountId, message, action, now = Date.now() } = {}) {
    const attachments = Array.isArray(message?.attachments) ? message.attachments : [];
    if (attachments.length === 0) {
      return Object.freeze({ message, scans: Object.freeze([]), provenance: null });
    }
    if (action !== 'send' && action !== 'draft') {
      throw new TypeError('outgoing attachment action must be send or draft');
    }
    if (!Number.isFinite(now)) throw new TypeError('now must be a finite timestamp');

    // Preserve one validation authority for all Gmail composition bounds and attachment syntax.
    buildGmailRawMessage(message);

    const securedAttachments = [];
    const scans = [];
    for (let index = 0; index < attachments.length; index += 1) {
      const attachment = attachments[index];
      const bytes = materializeValidatedAttachmentBytes(attachment);
      const digestSha256 = createHash('sha256').update(bytes).digest('hex');
      const resourceId = outgoingResourceId({
        accountId,
        clientMutationId: message?.clientMutationId,
        index,
        digestSha256,
      });

      let envelope;
      try {
        envelope = await this.wardveilScanClient.scan({
          resourceId,
          bytes,
          action,
        });
      } catch (error) {
        if (error instanceof AttachmentSecurityError) throw error;
        throw securityError('Wardveil Scan is currently unavailable for an outgoing attachment.', {
          code: ATTACHMENT_SECURITY_CODES.SCAN_UNAVAILABLE,
          status: 503,
          retryable: true,
          reason: 'wardveil_scan_unavailable',
          cause: error,
        });
      }

      const scan = requireCurrentCleanOutgoingScan(envelope, {
        resourceId,
        digestSha256,
        now,
      });
      scans.push(scan);
      securedAttachments.push(Object.freeze({
        filename: String(attachment.filename).trim(),
        contentType: attachment.contentType == null || attachment.contentType === ''
          ? 'application/octet-stream'
          : String(attachment.contentType).trim().toLowerCase(),
        bytes: Buffer.from(bytes),
      }));
    }

    const operationId = outgoingProvenanceOperationId({
      accountId,
      clientMutationId: message?.clientMutationId,
      action,
      scans,
    });
    try {
      const persisted = await this.persistProvenanceFn({
        rootDir: this.provenanceRootDir,
        operationId,
        action,
        scans,
      });
      if (
        !persisted ||
        persisted.operationId !== operationId ||
        persisted.action !== action ||
        !Array.isArray(persisted.scans) ||
        persisted.scans.length !== scans.length
      ) {
        throw new Error('outgoing provenance persistence acknowledgement is invalid');
      }
    } catch (error) {
      throw securityError('Wardveil Scan provenance could not be durably recorded for outgoing attachments.', {
        code: ATTACHMENT_SECURITY_CODES.SCAN_INVALID,
        status: 503,
        retryable: true,
        reason: 'outgoing_wardveil_scan_provenance_persistence_failed',
        cause: error,
      });
    }

    return Object.freeze({
      message: Object.freeze({
        ...message,
        attachments: Object.freeze(securedAttachments),
      }),
      scans: Object.freeze(scans),
      provenance: Object.freeze({ operationId, persisted: true }),
    });
  }
}

function materializeValidatedAttachmentBytes(attachment) {
  if (Buffer.isBuffer(attachment.bytes)) return Buffer.from(attachment.bytes);
  if (attachment.bytes instanceof Uint8Array) {
    return Buffer.from(attachment.bytes.buffer, attachment.bytes.byteOffset, attachment.bytes.byteLength);
  }
  return Buffer.from(String(attachment.contentBase64), 'base64');
}

function outgoingResourceId({ accountId, clientMutationId, index, digestSha256 }) {
  const digest = createHash('sha256')
    .update(String(accountId ?? ''), 'utf8')
    .update('\0')
    .update(String(clientMutationId ?? ''), 'utf8')
    .update('\0')
    .update(String(index), 'ascii')
    .update('\0')
    .update(digestSha256, 'ascii')
    .digest('hex');
  return `mail:outgoing:${digest}`;
}

function outgoingProvenanceOperationId({ accountId, clientMutationId, action, scans }) {
  const digest = createHash('sha256')
    .update('goreecloud-mail-outgoing-wardveil-provenance-v1', 'utf8')
    .update('\0')
    .update(String(accountId ?? ''), 'utf8')
    .update('\0')
    .update(String(clientMutationId ?? ''), 'utf8')
    .update('\0')
    .update(action, 'ascii');
  for (const scan of scans) {
    digest
      .update('\0')
      .update(scan.resourceId, 'utf8')
      .update('\0')
      .update(scan.digestSha256, 'ascii')
      .update('\0')
      .update(scan.recordId, 'utf8')
      .update('\0')
      .update(scan.correlationId, 'utf8');
  }
  return digest.digest('hex');
}

function requireCurrentCleanOutgoingScan(envelope, { resourceId, digestSha256, now }) {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    throw invalidScan('invalid_scan_envelope');
  }
  if (
    envelope.resource_id !== resourceId ||
    String(envelope.resource_digest_sha256 ?? '').toLowerCase() !== digestSha256
  ) {
    throw invalidScan('scan_resource_binding_mismatch');
  }

  const record = envelope.scan_record;
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw invalidScan('invalid_scan_record');
  }
  if (
    record.contract_version !== WARDVEIL_SCAN_CONTRACT_VERSION ||
    record.record_type !== 'scan_finding' ||
    !record.producer ||
    record.producer.authoritative !== true ||
    typeof record.producer.id !== 'string' ||
    !record.producer.id ||
    !record.scope ||
    record.scope.resource_type !== WARDVEIL_ATTACHMENT_RESOURCE_TYPE ||
    record.scope.resource_id !== resourceId ||
    typeof record.record_id !== 'string' ||
    !record.record_id ||
    typeof record.correlation_id !== 'string' ||
    !record.correlation_id ||
    !Array.isArray(record.evidence_refs) ||
    record.evidence_refs.length === 0 ||
    record.evidence_refs.some((ref) => typeof ref !== 'string' || !ref)
  ) {
    throw invalidScan('invalid_authoritative_scan_record');
  }

  const observedAt = parseInstant(record.observed_at);
  const validUntil = parseInstant(record.valid_until);
  if (observedAt > now || validUntil <= observedAt) {
    throw invalidScan('invalid_scan_evidence_time');
  }

  if (record.result === 'malicious') {
    throw securityError('Wardveil blocked an outgoing attachment because current evidence identifies malicious content.', {
      code: ATTACHMENT_SECURITY_CODES.SCAN_BLOCKED,
      reason: 'wardveil_scan_malicious',
      record,
      quarantineRequired: true,
    });
  }
  if (record.result === 'suspicious') {
    throw securityError('Wardveil is holding an outgoing attachment for security review.', {
      code: ATTACHMENT_SECURITY_CODES.SCAN_HELD,
      reason: 'wardveil_scan_suspicious',
      record,
    });
  }
  if (record.result === 'unknown' || record.result === 'unsupported') {
    throw securityError('Wardveil could not establish a clean result for an outgoing attachment.', {
      code: ATTACHMENT_SECURITY_CODES.SCAN_INVALID,
      status: 503,
      retryable: record.result === 'unknown',
      reason: `wardveil_scan_${record.result}`,
      record,
    });
  }
  if (record.result !== 'clean') throw invalidScan('unsupported_scan_result');
  if (validUntil <= now) {
    throw securityError('Wardveil Scan evidence for an outgoing attachment is no longer current.', {
      code: ATTACHMENT_SECURITY_CODES.SCAN_EXPIRED,
      reason: 'clean_scan_evidence_expired',
      record,
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
    resourceId,
    evidenceRefs: Object.freeze([...record.evidence_refs]),
  });
}

function parseInstant(value) {
  if (typeof value !== 'string' || !value) throw invalidScan('missing_scan_timestamp');
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw invalidScan('invalid_scan_timestamp');
  return parsed;
}

function invalidScan(reason) {
  return securityError('Wardveil Scan evidence for an outgoing attachment is invalid.', {
    code: ATTACHMENT_SECURITY_CODES.SCAN_INVALID,
    status: 503,
    reason,
  });
}

function securityError(message, {
  code,
  status = 423,
  retryable = false,
  reason,
  record = null,
  quarantineRequired = false,
  cause = null,
} = {}) {
  const error = new AttachmentSecurityError(message, {
    code,
    status,
    retryable,
    decision: {
      disposition: quarantineRequired ? 'block_quarantine' : 'blocked_unverified',
      canOpen: false,
      canDownload: false,
      quarantineRequired,
      reasonCodes: [reason],
      scanRecordId: typeof record?.record_id === 'string' ? record.record_id : null,
      evidenceRefs: Array.isArray(record?.evidence_refs)
        ? record.evidence_refs.filter((ref) => typeof ref === 'string' && ref)
        : [],
    },
  });
  if (cause) error.cause = cause;
  return error;
}
