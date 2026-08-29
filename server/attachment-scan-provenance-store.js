import { createHash, timingSafeEqual } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { mkdir, open, rename, rm } from 'node:fs/promises';
import path from 'node:path';

const PROVENANCE_SCHEMA_VERSION = 1;
const MAX_PROVENANCE_BYTES = 64 * 1024;
const MAX_EVIDENCE_REFS = 64;
const SHA256_RE = /^[0-9a-f]{64}$/;

export class AttachmentScanProvenanceError extends Error {
  constructor(message, { code = 'invalid-wardveil-scan-provenance', cause = null } = {}) {
    super(message);
    this.name = 'AttachmentScanProvenanceError';
    this.code = code;
    if (cause) this.cause = cause;
  }
}

export async function persistWardveilScanProvenance({ rootDir, objectId, provenance } = {}) {
  const normalizedObjectId = requireObjectId(objectId);
  if (!rootDir) throw new TypeError('rootDir is required');
  const normalized = normalizeProvenance(provenance);
  const payload = Object.freeze({
    object_id: normalizedObjectId,
    result: normalized.result,
    record_id: normalized.recordId,
    correlation_id: normalized.correlationId,
    producer_id: normalized.producerId,
    observed_at: normalized.observedAt,
    valid_until: normalized.validUntil,
    digest_sha256: normalized.digestSha256,
    evidence_refs: [...normalized.evidenceRefs],
  });
  const payloadJson = JSON.stringify(payload);
  const envelope = {
    schema_version: PROVENANCE_SCHEMA_VERSION,
    provenance: payload,
    integrity_sha256: createHash('sha256').update(payloadJson, 'utf8').digest('hex'),
  };
  const encoded = `${JSON.stringify(envelope)}\n`;
  if (Buffer.byteLength(encoded, 'utf8') > MAX_PROVENANCE_BYTES) {
    throw new AttachmentScanProvenanceError('Wardveil scan provenance exceeds the configured size bound.', { code: 'wardveil-scan-provenance-too-large' });
  }

  await mkdir(rootDir, { recursive: true, mode: 0o700 });
  const finalPath = provenancePath(rootDir, normalizedObjectId);
  const temporaryPath = temporaryProvenancePath(rootDir, normalizedObjectId);
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
  return Object.freeze({ ...normalized, evidenceRefs: Object.freeze([...normalized.evidenceRefs]) });
}

export function readWardveilScanProvenance({ rootDir, objectId } = {}) {
  const normalizedObjectId = requireObjectId(objectId);
  if (!rootDir) throw new TypeError('rootDir is required');
  const filePath = provenancePath(rootDir, normalizedObjectId);
  let encoded;
  try {
    const stat = statSync(filePath);
    if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_PROVENANCE_BYTES) {
      throw new AttachmentScanProvenanceError('Wardveil scan provenance file is outside the allowed size bound.');
    }
    encoded = readFileSync(filePath, 'utf8');
  } catch (error) {
    if (error instanceof AttachmentScanProvenanceError) throw error;
    throw new AttachmentScanProvenanceError('Wardveil scan provenance is unavailable.', {
      code: error?.code === 'ENOENT' ? 'wardveil-scan-provenance-missing' : 'wardveil-scan-provenance-read-failed',
      cause: error,
    });
  }

  let envelope;
  try {
    envelope = JSON.parse(encoded);
  } catch (error) {
    throw new AttachmentScanProvenanceError('Wardveil scan provenance is not valid JSON.', { cause: error });
  }
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope) || envelope.schema_version !== PROVENANCE_SCHEMA_VERSION) {
    throw new AttachmentScanProvenanceError('Wardveil scan provenance schema is unsupported.');
  }
  if (!envelope.provenance || typeof envelope.provenance !== 'object' || Array.isArray(envelope.provenance)) {
    throw new AttachmentScanProvenanceError('Wardveil scan provenance payload is invalid.');
  }
  if (envelope.provenance.object_id !== normalizedObjectId) {
    throw new AttachmentScanProvenanceError('Wardveil scan provenance object binding mismatch.');
  }
  if (!SHA256_RE.test(String(envelope.integrity_sha256 ?? ''))) {
    throw new AttachmentScanProvenanceError('Wardveil scan provenance integrity digest is invalid.');
  }

  const expected = Buffer.from(createHash('sha256').update(JSON.stringify(envelope.provenance), 'utf8').digest('hex'), 'ascii');
  const actual = Buffer.from(envelope.integrity_sha256, 'ascii');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new AttachmentScanProvenanceError('Wardveil scan provenance integrity verification failed.');
  }

  return normalizeProvenance({
    result: envelope.provenance.result,
    recordId: envelope.provenance.record_id,
    correlationId: envelope.provenance.correlation_id,
    producerId: envelope.provenance.producer_id,
    observedAt: envelope.provenance.observed_at,
    validUntil: envelope.provenance.valid_until,
    digestSha256: envelope.provenance.digest_sha256,
    evidenceRefs: envelope.provenance.evidence_refs,
  });
}

export async function removeWardveilScanProvenance({ rootDir, objectId } = {}) {
  const normalizedObjectId = requireObjectId(objectId);
  if (!rootDir) throw new TypeError('rootDir is required');
  await rm(provenancePath(rootDir, normalizedObjectId), { force: true });
  await rm(temporaryProvenancePath(rootDir, normalizedObjectId), { force: true });
}

export function wardveilScanProvenancePath({ rootDir, objectId } = {}) {
  if (!rootDir) throw new TypeError('rootDir is required');
  return provenancePath(rootDir, requireObjectId(objectId));
}

function normalizeProvenance(provenance) {
  if (!provenance || typeof provenance !== 'object' || Array.isArray(provenance)) {
    throw new AttachmentScanProvenanceError('Wardveil scan provenance must be an object.');
  }
  if (provenance.result !== 'clean') {
    throw new AttachmentScanProvenanceError('Only current clean Wardveil scan provenance may be persisted.');
  }
  const recordId = requireBoundedString(provenance.recordId, 'recordId');
  const correlationId = requireBoundedString(provenance.correlationId, 'correlationId');
  const producerId = requireBoundedString(provenance.producerId, 'producerId');
  const observedAt = requireInstant(provenance.observedAt, 'observedAt');
  const validUntil = requireInstant(provenance.validUntil, 'validUntil');
  if (Date.parse(validUntil) <= Date.parse(observedAt)) {
    throw new AttachmentScanProvenanceError('Wardveil scan provenance validity window is invalid.');
  }
  const digestSha256 = String(provenance.digestSha256 ?? '').toLowerCase();
  if (!SHA256_RE.test(digestSha256)) throw new AttachmentScanProvenanceError('Wardveil scan provenance digest is invalid.');
  if (!Array.isArray(provenance.evidenceRefs) || provenance.evidenceRefs.length < 1 || provenance.evidenceRefs.length > MAX_EVIDENCE_REFS) {
    throw new AttachmentScanProvenanceError('Wardveil scan provenance evidence references are invalid.');
  }
  const evidenceRefs = provenance.evidenceRefs.map((value) => requireBoundedString(value, 'evidenceRef'));
  return Object.freeze({
    result: 'clean',
    recordId,
    correlationId,
    producerId,
    observedAt,
    validUntil,
    digestSha256,
    evidenceRefs: Object.freeze(evidenceRefs),
  });
}

function requireObjectId(value) {
  const objectId = String(value ?? '');
  if (!/^[A-Za-z0-9._-]+$/.test(objectId)) throw new TypeError('objectId is invalid');
  return objectId;
}

function requireBoundedString(value, name) {
  if (typeof value !== 'string' || !value || Buffer.byteLength(value, 'utf8') > 1024) {
    throw new AttachmentScanProvenanceError(`${name} is invalid.`);
  }
  for (const char of value) {
    const code = char.codePointAt(0);
    if (code < 0x20 || code === 0x7f) throw new AttachmentScanProvenanceError(`${name} contains control characters.`);
  }
  return value;
}

function requireInstant(value, name) {
  const text = requireBoundedString(value, name);
  if (!Number.isFinite(Date.parse(text))) throw new AttachmentScanProvenanceError(`${name} is not a valid timestamp.`);
  return text;
}

function provenancePath(rootDir, objectId) {
  return path.join(rootDir, `.${objectId}.wardveil-scan.json`);
}

function temporaryProvenancePath(rootDir, objectId) {
  return path.join(rootDir, `.${objectId}.wardveil-scan.partial`);
}
