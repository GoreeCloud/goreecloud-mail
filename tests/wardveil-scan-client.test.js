import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';

import {
  MAIL_ATTACHMENT_RESOURCE_TYPE,
  WARDVEIL_SCAN_CONTRACT_VERSION,
  WardveilScanClient,
  canonicalScanAuthMaterial,
} from '../server/wardveil-scan-client.js';

const SECRET = 'mail-wardveil-test-secret-0123456789abcdef';
const NOW = new Date('2026-08-29T10:00:00.000Z');
const CONTENT = Buffer.from('mail attachment payload');

function envelope({ correlationId = 'mail-scan-correlation', result = 'clean', field = 'result' } = {}) {
  const digest = createHash('sha256').update(CONTENT).digest('hex');
  return {
    resource_id: 'mail:message-1:attachment:attachment-1',
    resource_digest_sha256: digest,
    scan_record: {
      contract_version: WARDVEIL_SCAN_CONTRACT_VERSION,
      record_id: 'scan-record-1',
      record_type: 'scan_finding',
      correlation_id: correlationId,
      producer: { id: 'wardveil-scan-clamav', authoritative: true },
      scope: {
        resource_type: MAIL_ATTACHMENT_RESOURCE_TYPE,
        resource_id: 'mail:message-1:attachment:attachment-1',
      },
      observed_at: '2026-08-29T09:59:59+00:00',
      valid_until: '2026-08-29T10:09:59+00:00',
      [field]: result,
      evidence_refs: ['wardveil:clamav:health:1'],
    },
  };
}

function jsonResponse(payload, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function clientWith(fetchImpl) {
  return new WardveilScanClient({
    endpoint: 'http://127.0.0.1:8791/v1/scan',
    callerId: 'goreecloud-mail',
    keyId: 'scan-current',
    secret: SECRET,
    now: () => NOW,
    nonce: () => 'mail-nonce-1',
    correlationId: () => 'mail-scan-correlation',
    fetchImpl,
  });
}

test('Mail signs exact Wardveil 0.1.0 request material and accepts result envelope', async () => {
  let captured;
  const client = clientWith(async (url, options) => {
    captured = { url: String(url), options };
    return jsonResponse(envelope());
  });

  const result = await client.scanAttachment({
    messageId: 'message-1',
    attachmentId: 'attachment-1',
    bytes: CONTENT,
    action: 'open',
  });

  const digest = createHash('sha256').update(CONTENT).digest('hex');
  const material = canonicalScanAuthMaterial({
    callerId: 'goreecloud-mail',
    keyId: 'scan-current',
    timestamp: NOW.toISOString(),
    nonce: 'mail-nonce-1',
    action: 'open',
    resourceType: 'mail_attachment',
    resourceId: 'mail:message-1:attachment:attachment-1',
    correlationId: 'mail-scan-correlation',
    sizeBytes: CONTENT.length,
    digestSha256: digest,
  });
  const expectedSignature = createHmac('sha256', Buffer.from(SECRET)).update(material).digest('hex');

  assert.equal(captured.url, 'http://127.0.0.1:8791/v1/scan');
  assert.equal(captured.options.redirect, 'manual');
  assert.equal(captured.options.headers['x-wardveil-resource-type'], 'mail_attachment');
  assert.equal(captured.options.headers['x-wardveil-resource-id'], 'mail:message-1:attachment:attachment-1');
  assert.equal(captured.options.headers['x-wardveil-digest-sha256'], digest);
  assert.equal(captured.options.headers['x-wardveil-signature'], expectedSignature);
  assert.equal(result.scan_record.result, 'clean');
  assert.equal(result.scan_record.correlation_id, 'mail-scan-correlation');
});

test('Mail rejects unsafe Wardveil endpoint configuration', () => {
  for (const endpoint of [
    'https://127.0.0.1:8791/v1/scan',
    'http://localhost:8791/v1/scan',
    'http://127.0.0.1/v1/scan',
    'http://127.0.0.1:8791/other',
    'http://user@127.0.0.1:8791/v1/scan',
    'http://127.0.0.1:8791/v1/scan?x=1',
  ]) {
    assert.throws(() => new WardveilScanClient({ endpoint, secret: SECRET }));
  }
});

test('Mail rejects obsolete scan_result application envelope', async () => {
  const client = clientWith(async () => jsonResponse(envelope({ field: 'scan_result' })));
  await assert.rejects(
    () => client.scanAttachment({ messageId: 'message-1', attachmentId: 'attachment-1', bytes: CONTENT, action: 'open' }),
    /obsolete scan_result/,
  );
});

test('Mail rejects Wardveil response correlation mismatch', async () => {
  const client = clientWith(async () => jsonResponse(envelope({ correlationId: 'different-correlation' })));
  await assert.rejects(
    () => client.scanAttachment({ messageId: 'message-1', attachmentId: 'attachment-1', bytes: CONTENT, action: 'open' }),
    /correlation mismatch/,
  );
});

test('Mail fails closed on non-success Wardveil response without upstream-detail leakage', async () => {
  const client = clientWith(async () => jsonResponse({ detail: 'do not leak this' }, { status: 503 }));
  await assert.rejects(
    () => client.scanAttachment({ messageId: 'message-1', attachmentId: 'attachment-1', bytes: CONTENT, action: 'download' }),
    (error) => /HTTP 503/.test(error.message) && !/do not leak this/.test(error.message),
  );
});

test('Mail fails closed when Wardveil response exceeds configured bound', async () => {
  const client = new WardveilScanClient({
    endpoint: 'http://127.0.0.1:8791/v1/scan',
    secret: SECRET,
    maxResponseBytes: 64,
    now: () => NOW,
    nonce: () => 'mail-nonce-1',
    correlationId: () => 'mail-scan-correlation',
    fetchImpl: async () => jsonResponse(envelope()),
  });
  await assert.rejects(
    () => client.scanAttachment({ messageId: 'message-1', attachmentId: 'attachment-1', bytes: CONTENT, action: 'open' }),
    /exceeds configured limit/,
  );
});
