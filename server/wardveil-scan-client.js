import { createHash, createHmac, randomBytes } from 'node:crypto';

export const WARDVEIL_SCAN_CONTRACT_VERSION = '0.1.0';
export const WARDVEIL_SCAN_PATH = '/v1/scan';
export const MAIL_ATTACHMENT_RESOURCE_TYPE = 'mail_attachment';

const TOKEN_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/;
const ACTION_RE = /^[a-z][a-z0-9_:-]{0,63}$/;
const MINIMUM_SECRET_BYTES = 32;
const DEFAULT_TIMEOUT_MS = 35_000;
const DEFAULT_MAX_RESPONSE_BYTES = 1 << 20;

function requireToken(value, name) {
  if (typeof value !== 'string' || !TOKEN_RE.test(value)) {
    throw new TypeError(`${name} must be a Wardveil token`);
  }
  return value;
}

function requireResourceId(value) {
  if (typeof value !== 'string' || value.length === 0 || Buffer.byteLength(value, 'utf8') > 1024) {
    throw new TypeError('Wardveil Scan resource ID is invalid');
  }
  for (const char of value) {
    const code = char.codePointAt(0);
    if (code < 0x20 || code === 0x7f) {
      throw new TypeError('Wardveil Scan resource ID contains control characters');
    }
  }
  return value;
}

function validateEndpoint(raw) {
  const endpoint = new URL(raw);
  if (endpoint.protocol !== 'http:' || endpoint.hostname !== '127.0.0.1') {
    throw new TypeError('Wardveil Scan endpoint must use IPv4 loopback HTTP');
  }
  if (!endpoint.port || endpoint.pathname !== WARDVEIL_SCAN_PATH) {
    throw new TypeError(`Wardveil Scan endpoint must include an explicit port and ${WARDVEIL_SCAN_PATH}`);
  }
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new TypeError('Wardveil Scan endpoint must not include credentials, query, or fragment');
  }
  return endpoint;
}

function normalizeSecret(secret) {
  const value = Buffer.isBuffer(secret) ? Buffer.from(secret) : Buffer.from(String(secret ?? ''), 'utf8');
  if (value.length < MINIMUM_SECRET_BYTES) {
    throw new TypeError('Wardveil Scan caller secret must be at least 32 bytes');
  }
  if (!Buffer.isBuffer(secret)) {
    const text = String(secret ?? '');
    if (text !== text.trim()) {
      throw new TypeError('Wardveil Scan caller secret must not contain surrounding whitespace');
    }
  }
  return value;
}

function randomToken(prefix) {
  return `${prefix}-${randomBytes(16).toString('hex')}`;
}

export function canonicalScanAuthMaterial(fields) {
  return [
    WARDVEIL_SCAN_CONTRACT_VERSION,
    fields.callerId,
    fields.keyId,
    fields.timestamp,
    fields.nonce,
    fields.action,
    fields.resourceType,
    fields.resourceId,
    fields.correlationId,
    String(fields.sizeBytes),
    fields.digestSha256,
  ].join('\n');
}

function validateEnvelope(payload, expected) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Wardveil Scan response envelope is invalid');
  }
  if (payload.resource_id !== expected.resourceId || String(payload.resource_digest_sha256 ?? '').toLowerCase() !== expected.digestSha256) {
    throw new Error('Wardveil Scan response resource binding mismatch');
  }
  const record = payload.scan_record;
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error('Wardveil Scan response record is invalid');
  }
  if (Object.hasOwn(record, 'scan_result')) {
    throw new Error('Wardveil Scan response uses obsolete scan_result field');
  }
  if (record.contract_version !== WARDVEIL_SCAN_CONTRACT_VERSION || record.record_type !== 'scan_finding') {
    throw new Error('Wardveil Scan response contract is unsupported');
  }
  if (record.correlation_id !== expected.correlationId) {
    throw new Error('Wardveil Scan response correlation mismatch');
  }
  if (!record.producer || record.producer.authoritative !== true || typeof record.producer.id !== 'string' || !record.producer.id) {
    throw new Error('Wardveil Scan response producer is not authoritative');
  }
  if (!record.scope || record.scope.resource_type !== MAIL_ATTACHMENT_RESOURCE_TYPE || record.scope.resource_id !== expected.resourceId) {
    throw new Error('Wardveil Scan response scope mismatch');
  }
  if (!['clean', 'suspicious', 'malicious', 'unknown', 'unsupported'].includes(record.result)) {
    throw new Error('Wardveil Scan response result is invalid');
  }
  if (!Array.isArray(record.evidence_refs) || record.evidence_refs.some((ref) => typeof ref !== 'string' || !ref)) {
    throw new Error('Wardveil Scan response evidence references are invalid');
  }
  return payload;
}

export class WardveilScanClient {
  constructor({
    endpoint = 'http://127.0.0.1:8791/v1/scan',
    callerId = 'goreecloud-mail',
    keyId = 'scan-current',
    secret,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES,
    fetchImpl = globalThis.fetch,
    now = () => new Date(),
    nonce = () => randomToken('mail-nonce'),
    correlationId = () => randomToken('mail-scan'),
  } = {}) {
    this.endpoint = validateEndpoint(endpoint);
    this.callerId = requireToken(callerId, 'Wardveil Scan caller ID');
    this.keyId = requireToken(keyId, 'Wardveil Scan key ID');
    this.secret = normalizeSecret(secret);
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || !Number.isInteger(maxResponseBytes) || maxResponseBytes <= 0) {
      throw new TypeError('Wardveil Scan timeout and response limit must be positive integers');
    }
    if (typeof fetchImpl !== 'function' || typeof now !== 'function' || typeof nonce !== 'function' || typeof correlationId !== 'function') {
      throw new TypeError('Wardveil Scan client dependencies are invalid');
    }
    this.timeoutMs = timeoutMs;
    this.maxResponseBytes = maxResponseBytes;
    this.fetchImpl = fetchImpl;
    this.now = now;
    this.nonce = nonce;
    this.correlationId = correlationId;
  }

  async scanAttachment({ messageId, attachmentId, bytes, action = 'open' }) {
    requireToken(messageId, 'Mail message ID');
    requireToken(attachmentId, 'Mail attachment ID');
    return this.scan({ resourceId: `mail:${messageId}:attachment:${attachmentId}`, bytes, action });
  }

  async scan({ resourceId, bytes, action }) {
    requireResourceId(resourceId);
    if (typeof action !== 'string' || !ACTION_RE.test(action)) {
      throw new TypeError('Wardveil Scan action is invalid');
    }
    const content = Buffer.isBuffer(bytes) ? Buffer.from(bytes) : Buffer.from(bytes ?? []);
    const digestSha256 = createHash('sha256').update(content).digest('hex');
    const timestamp = this.now().toISOString();
    const nonce = requireToken(this.nonce(), 'Wardveil Scan nonce');
    const correlationId = requireToken(this.correlationId(), 'Wardveil Scan correlation ID');
    const fields = {
      callerId: this.callerId,
      keyId: this.keyId,
      timestamp,
      nonce,
      action,
      resourceType: MAIL_ATTACHMENT_RESOURCE_TYPE,
      resourceId,
      correlationId,
      sizeBytes: content.length,
      digestSha256,
    };
    const signature = createHmac('sha256', this.secret).update(canonicalScanAuthMaterial(fields), 'utf8').digest('hex');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    timer.unref?.();
    let response;
    try {
      response = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        redirect: 'manual',
        headers: {
          'content-type': 'application/octet-stream',
          'x-wardveil-caller-id': this.callerId,
          'x-wardveil-key-id': this.keyId,
          'x-wardveil-timestamp': timestamp,
          'x-wardveil-nonce': nonce,
          'x-wardveil-resource-type': MAIL_ATTACHMENT_RESOURCE_TYPE,
          'x-wardveil-resource-id': resourceId,
          'x-wardveil-digest-sha256': digestSha256,
          'x-wardveil-size-bytes': String(content.length),
          'x-wardveil-action': action,
          'x-wardveil-correlation-id': correlationId,
          'x-wardveil-signature': signature,
        },
        body: content,
        signal: controller.signal,
      });
    } catch (error) {
      throw new Error('Wardveil Scan transport unavailable', { cause: error });
    } finally {
      clearTimeout(timer);
    }

    if (!response || response.status !== 200) {
      throw new Error(`Wardveil Scan returned HTTP ${response?.status ?? 'unavailable'}`);
    }
    const contentType = String(response.headers?.get?.('content-type') ?? '').toLowerCase();
    if (!contentType.startsWith('application/json')) {
      throw new Error('Wardveil Scan response content type is invalid');
    }
    const declaredLength = Number(response.headers?.get?.('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > this.maxResponseBytes) {
      throw new Error('Wardveil Scan response exceeds configured limit');
    }
    const encoded = Buffer.from(await response.arrayBuffer());
    if (encoded.length > this.maxResponseBytes) {
      throw new Error('Wardveil Scan response exceeds configured limit');
    }
    let payload;
    try {
      payload = JSON.parse(encoded.toString('utf8'));
    } catch (error) {
      throw new Error('Wardveil Scan response is not valid JSON', { cause: error });
    }
    return validateEnvelope(payload, { resourceId, digestSha256, correlationId });
  }
}
