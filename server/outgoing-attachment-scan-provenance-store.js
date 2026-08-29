import { createHash, timingSafeEqual } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { mkdir, open, rename, rm } from 'node:fs/promises';
import path from 'node:path';

const PROVENANCE_SCHEMA_VERSION = 1;
const MAX_PROVENANCE_BYTES = 128 * 1024;
const MAX_SCANS = 64;
const MAX_EVIDENCE_REFS = 64;
const SHA256_RE = /^[0-9a-f]{64}$/;
const RESOURCE_ID_RE = /^mail:outgoing:[0-9a-f]{64}$/;

export class OutgoingAttachmentScanProvenanceError extends Error {
  constructor(message, { code = 'invalid-outgoing-wardveil-scan-provenance', cause = null } = {}) {
    super(message);
    this.name = 'OutgoingAttachmentScanProvenanceError';
    this.code = code;
    if (cause) this.cause = cause;
  }
}

export async function persistOutgoingWardveilScanProvenance({ rootDir, operationId, action, scans } = {}) {
  const normalizedOperationId = requireOperationId(operationId);
  const normalizedAction = requireAction(action);
  if (!rootDir) throw new TypeError('rootDir is required');
  const normalizedScans = normalizeScans(scans);
  const payload = Object.freeze({
    operation_id: normalizedOperationId,
    action: normalizedAction,
    scans: normalizedScans.map((scan) => ({
      result: scan.result,
      record_id: scan.recordId,
      correlation_id: scan.correlationId,
      producer_id: scan.producerId,
      observed_at: scan.observedAt,
      valid_until: scan.validUntil,
      digest_sha256: scan.digestSha256,
      resource_id: scan.resourceId,
      evidence_refs: [...scan.evidenceRefs],
    })),
  });
  const payloadJson = JSON.stringify(payload);
  const envelope = {
    schema_version: PROVENANCE_SCHEMA_VERSION,
    provenance: payload,
    integrity_sha256: createHash('sha256').update(payloadJson, 'utf8').digest('hex'),
  };
  const encoded = `${JSON.stringify(envelope)}\n`;
  if (Buffer.byteLength(encoded, 'utf8') > MAX_PROVENANCE_BYTES) {
    throw new OutgoingAttachmentScanProvenanceError(
      'Outgoing Wardveil scan provenance exceeds the configured size bound.',
      { code: 'outgoing-wardveil-scan-provenance-too-large' },
    );
  }

  await mkdir(rootDir, { recursive: true, mode: 0o700 });
  const finalPath = provenancePath(rootDir, normalizedOperationId);
  const temporaryPath = temporaryProvenancePath(rootDir, normalizedOperationId);
  await rm(temporaryPath, { force: true });
  const handle = await open(temporaryPath, 'wx', 0o600);
  try {
    await handle.writeFile(encoded, 'utf8');
    await handle.sync();
    await handle.close();
    await rename(temporaryPath, finalPath);
  } catch (error) {
    await handle.close().catch(() => {});
    await rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }

  return Object.freeze({
    operationId: normalizedOperationId,
    action: normalizedAction,
    scans: Object.freeze(normalizedScans),
  });
}

export function readOutgoingWardveilScanProvenance({ rootDir, operationId } = {}) {
  const normalizedOperationId = requireOperationId(operationId);
  if (!rootDir) throw new TypeError('rootDir is required');
  const filePath = provenancePath(rootDir, normalizedOperationId);
  let encoded;
  try {
    const stat = statSync(filePath);
    if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_PROVENANCE_BYTES) {
      throw new OutgoingAttachmentScanProvenanceError(
        'Outgoing Wardveil scan provenance file is outside the allowed size bound.',
      );
    }
    encoded = readFileSync(filePath, 'utf8');
  } catch (error) {
    if (error instanceof OutgoingAttachmentScanProvenanceError) throw error;
    throw new OutgoingAttachmentScanProvenanceError('Outgoing Wardveil scan provenance is unavailable.', {
      code: error?.code === 'ENOENT'
        ? 'outgoing-wardveil-scan-provenance-missing'
        : 'outgoing-wardveil-scan-provenance-read-failed',
      cause: error,
    });
  }

  let envelope;
  try {
    envelope = JSON.parse(encoded);
  } catch (error) {
    throw new OutgoingAttachmentScanProvenanceError(
      'Outgoing Wardveil scan provenance is not valid JSON.',
      { cause: error },
    );
  }
  if (
    !envelope ||
    typeof envelope !== 'object' ||
    Array.isArray(envelope) ||
    envelope.schema_version !== PROVENANCE_SCHEMA_VERSION ||
    !envelope.provenance ||
    typeof envelope.provenance !== 'object' ||
    Array.isArray(envelope.provenance)
  ) {
    throw new OutgoingAttachmentScanProvenanceError('Outgoing Wardveil scan provenance schema is unsupported.');
  }
  if (envelope.provenance.operation_id !== normalizedOperationId) {
    throw new OutgoingAttachmentScanProvenanceError('Outgoing Wardveil scan provenance operation binding mismatch.');
  }
  if (!SHA256_RE.test(String(envelope.integrity_sha256 ?? ''))) {
    throw new OutgoingAttachmentScanProvenanceError('Outgoing Wardveil scan provenance integrity digest is invalid.');
  }

  const expected = Buffer.from(
    createHash('sha256').update(JSON.stringify(envelope.provenance), 'utf8').digest('hex'),
    'ascii',
  );
  const actual = Buffer.from(envelope.integrity_sha256, 'ascii');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new OutgoingAttachmentScanProvenanceError('Outgoing Wardveil scan provenance integrity verification failed.');
  }

  const action = requireAction(envelope.provenance.action);
  const scans = normalizeScans((envelope.provenance.scans || []).map((scan) => ({
    result: scan.result,
    recordId: scan.record_id,
    correlationId: scan.correlation_id,
    producerId: scan.producer_id,
    observedAt: scan.observed_at,
    validUntil: scan.valid_until,
    digestSha256: scan.digest_sha256,
    resourceId: scan.resource_id,
    evidenceRefs: scan.evidence_refs,
  })));
  return Object.freeze({ operationId: normalizedOperationId, action, scans: Object.freeze(scans) });
}

export async function removeOutgoingWardveilScanProvenance({ rootDir, operationId } = {}) {
  const normalizedOperationId = requireOperationId(operationId);
  if (!rootDir) throw new TypeError('rootDir is required');
  await rm(provenancePath(rootDir, normalizedOperationId), { force: true });
  await rm(temporaryProvenancePath(rootDir, normalizedOperationId), { force: true });
}

export function outgoingWardveilScanProvenancePath({ rootDir, operationId } = {}) {
  if (!rootDir) throw new TypeError('rootDir is required');
  return provenancePath(rootDir, requireOperationId(operationId));
}

function normalizeScans(scans) {
  if (!Array.isArray(scans) || scans.length < 1 || scans.length > MAX_SCANS) {
    throw new OutgoingAttachmentScanProvenanceError('Outgoing Wardveil scan provenance scan set is invalid.');
  }
  return scans.map((scan) => normalizeScan(scan));
}

function normalizeScan(scan) {
  if (!scan || typeof scan !== 'object' || Array.isArray(scan) || scan.result !== 'clean') {
    throw new OutgoingAttachmentScanProvenanceError('Only current clean outgoing Wardveil scan provenance may be persisted.');
  }
  const recordId = requireBoundedString(scan.recordId, 'recordId');
  const correlationId = requireBoundedString(scan.correlationId, 'correlationId');
  const producerId = requireBoundedString(scan.producerId, 'producerId');
  const observedAt = requireInstant(scan.observedAt, 'observedAt');
  const validUntil = requireInstant(scan.validUntil, 'validUntil');
  if (Date.parse(validUntil) <= Date.parse(observedAt)) {
    throw new OutgoingAttachmentScanProvenanceError('Outgoing Wardveil scan provenance validity window is invalid.');
  }
  const digestSha256 = String(scan.digestSha256 ?? '').toLowerCase();
  if (!SHA256_RE.test(digestSha256)) {
    throw new OutgoingAttachmentScanProvenanceError('Outgoing Wardveil scan provenance digest is invalid.');
  }
  const resourceId = String(scan.resourceId ?? '');
  if (!RESOURCE_ID_RE.test(resourceId)) {
    throw new OutgoingAttachmentScanProvenanceError('Outgoing Wardveil scan provenance resource binding is invalid.');
  }
  if (!Array.isArray(scan.evidenceRefs) || scan.evidenceRefs.length < 1 || scan.evidenceRefs.length > MAX_EVIDENCE_REFS) {
    throw new OutgoingAttachmentScanProvenanceError('Outgoing Wardveil scan provenance evidence references are invalid.');
  }
  const evidenceRefs = scan.evidenceRefs.map((value) => requireBoundedString(value, 'evidenceRef'));
  return Object.freeze({
    result: 'clean',
    recordId,
    correlationId,
    producerId,
    observedAt,
    validUntil,
    digestSha256,
    resourceId,
    evidenceRefs: Object.freeze(evidenceRefs),
  });
}

function requireOperationId(value) {
  const operationId = String(value ?? '').toLowerCase();
  if (!SHA256_RE.test(operationId)) throw new TypeError('operationId is invalid');
  return operationId;
}

function requireAction(value) {
  if (value !== 'send' && value !== 'draft') throw new TypeError('action must be send or draft');
  return value;
}

function requireBoundedString(value, name) {
  if (typeof value !== 'string' || !value || Buffer.byteLength(value, 'utf8') > 1024) {
    throw new OutgoingAttachmentScanProvenanceError(`${name} is invalid.`);
  }
  for (const char of value) {
    const code = char.codePointAt(0);
    if (code < 0x20 || code === 0x7f) {
      throw new OutgoingAttachmentScanProvenanceError(`${name} contains control characters.`);
    }
  }
  return value;
}

function requireInstant(value, name) {
  const text = requireBoundedString(value, name);
  if (!Number.isFinite(Date.parse(text))) {
    throw new OutgoingAttachmentScanProvenanceError(`${name} is not a valid timestamp.`);
  }
  return text;
}

function provenancePath(rootDir, operationId) {
  return path.join(rootDir, `.wardveil-outgoing-${operationId}.json`);
}

function temporaryProvenancePath(rootDir, operationId) {
  return path.join(rootDir, `.wardveil-outgoing-${operationId}.partial`);
}
