import { createHash } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';

import { ATTACHMENT_SECURITY_CODES } from '../server/attachment-delivery-service.js';
import { GmailAccountService } from '../server/gmail-account-service.js';
import { GmailOutgoingAttachmentSecurityGate } from '../server/gmail-outgoing-attachment-security.js';
import { decodeGmailRawMessage } from '../server/gmail-message-builder.js';

const TEST_NOW = Date.parse('2026-08-29T20:30:00.000Z');

function scanClient(calls, {
  result = 'clean',
  throwError = null,
  observedAt = '2026-08-29T20:29:00.000Z',
  validUntil = '2026-08-29T20:40:00.000Z',
  authoritative = true,
} = {}) {
  return {
    async scan(args) {
      calls.push({ ...args, bytes: Buffer.from(args.bytes) });
      if (throwError) throw throwError;
      const digest = createHash('sha256').update(args.bytes).digest('hex');
      return {
        resource_id: args.resourceId,
        resource_digest_sha256: digest,
        scan_record: {
          contract_version: '0.1.0',
          record_id: `outgoing-${result}-1`,
          record_type: 'scan_finding',
          correlation_id: 'mail-outgoing-correlation-1',
          producer: { id: 'wardveil-scan', authoritative },
          scope: { resource_type: 'mail_attachment', resource_id: args.resourceId },
          observed_at: observedAt,
          valid_until: validUntil,
          result,
          evidence_refs: ['wardveil:evidence:outgoing-1'],
        },
      };
    },
  };
}

function messageWithAttachment() {
  return {
    to: 'recipient@example.test',
    subject: 'Scanned attachment',
    body: 'See attached.',
    clientMutationId: 'mutation-1',
    attachments: [
      {
        filename: ' report.txt ',
        contentType: 'TEXT/PLAIN',
        contentBase64: Buffer.from('exact outgoing bytes', 'utf8').toString('base64'),
      },
    ],
  };
}

test('outgoing gate scans exact validated bytes and returns those same bytes for MIME serialization', async () => {
  const calls = [];
  const gate = new GmailOutgoingAttachmentSecurityGate({ wardveilScanClient: scanClient(calls) });
  const result = await gate.authorize({
    accountId: 'account-a',
    message: messageWithAttachment(),
    action: 'send',
    now: TEST_NOW,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].action, 'send');
  assert.deepEqual(calls[0].bytes, Buffer.from('exact outgoing bytes', 'utf8'));
  assert.match(calls[0].resourceId, /^mail:outgoing:[0-9a-f]{64}$/);
  assert.equal(result.scans[0].result, 'clean');
  assert.deepEqual(result.message.attachments[0].bytes, calls[0].bytes);
  assert.equal(result.message.attachments[0].filename, 'report.txt');
  assert.equal(result.message.attachments[0].contentType, 'text/plain');

  const built = decodeGmailRawMessage(
    (await import('../server/gmail-message-builder.js')).buildGmailRawMessage(result.message).raw,
  );
  assert.match(built, /ZXhhY3Qgb3V0Z29pbmcgYnl0ZXM=/);
});

test('outgoing gate blocks malicious, suspicious, unknown, and expired evidence before provider writes', async () => {
  for (const [result, expectedCode] of [
    ['malicious', ATTACHMENT_SECURITY_CODES.SCAN_BLOCKED],
    ['suspicious', ATTACHMENT_SECURITY_CODES.SCAN_HELD],
    ['unknown', ATTACHMENT_SECURITY_CODES.SCAN_INVALID],
  ]) {
    const gate = new GmailOutgoingAttachmentSecurityGate({ wardveilScanClient: scanClient([], { result }) });
    await assert.rejects(
      () => gate.authorize({ accountId: 'account-a', message: messageWithAttachment(), action: 'send', now: TEST_NOW }),
      (error) => error.code === expectedCode,
    );
  }

  const expired = new GmailOutgoingAttachmentSecurityGate({
    wardveilScanClient: scanClient([], { validUntil: '2026-08-29T20:29:30.000Z' }),
  });
  await assert.rejects(
    () => expired.authorize({ accountId: 'account-a', message: messageWithAttachment(), action: 'send', now: TEST_NOW }),
    (error) => error.code === ATTACHMENT_SECURITY_CODES.SCAN_EXPIRED,
  );
});

test('outgoing gate maps scanner transport failure to retryable fail-closed state', async () => {
  const gate = new GmailOutgoingAttachmentSecurityGate({
    wardveilScanClient: scanClient([], { throwError: new Error('private scanner detail') }),
  });
  await assert.rejects(
    () => gate.authorize({ accountId: 'account-a', message: messageWithAttachment(), action: 'draft', now: TEST_NOW }),
    (error) =>
      error.code === ATTACHMENT_SECURITY_CODES.SCAN_UNAVAILABLE &&
      error.status === 503 &&
      error.retryable === true &&
      !/private scanner detail/.test(error.message),
  );
});

test('GmailAccountService refuses attachment writes when no outgoing Wardveil gate is configured', async () => {
  let clientCreations = 0;
  const service = new GmailAccountService({
    accountService: {
      get: () => ({ id: 'account-a', provider: 'gmail' }),
      requireCapabilities: async () => {},
    },
    gmailClientFactory: () => {
      clientCreations += 1;
      return { sendMessage: async () => ({ id: 'sent-1' }) };
    },
  });

  await assert.rejects(
    () => service.send({ session: { userId: 'user-a' }, accountId: 'account-a', message: messageWithAttachment() }),
    (error) => error.code === ATTACHMENT_SECURITY_CODES.SCAN_UNAVAILABLE && error.status === 503,
  );
  assert.equal(clientCreations, 0);
});

test('GmailAccountService scans before send and serializes only authorized attachment bytes', async () => {
  const scanCalls = [];
  const providerCalls = [];
  const gate = new GmailOutgoingAttachmentSecurityGate({ wardveilScanClient: scanClient(scanCalls, {
    observedAt: new Date(Date.now() - 60_000).toISOString(),
    validUntil: new Date(Date.now() + 10 * 60_000).toISOString(),
  }) });
  const service = new GmailAccountService({
    accountService: {
      get: () => ({ id: 'account-a', provider: 'gmail' }),
      requireCapabilities: async () => {},
    },
    outgoingAttachmentSecurityGate: gate,
    gmailClientFactory: () => ({
      async sendMessage(_context, { raw }) {
        providerCalls.push(raw);
        return { id: 'sent-1', threadId: 'thread-1', labelIds: ['SENT'] };
      },
    }),
  });

  const result = await service.send({
    session: { userId: 'user-a' },
    accountId: 'account-a',
    message: messageWithAttachment(),
  });

  assert.equal(result.id, 'sent-1');
  assert.equal(scanCalls.length, 1);
  assert.equal(providerCalls.length, 1);
  assert.deepEqual(scanCalls[0].bytes, Buffer.from('exact outgoing bytes', 'utf8'));
  assert.match(decodeGmailRawMessage(providerCalls[0]), /Content-Disposition: attachment;/);
  assert.match(decodeGmailRawMessage(providerCalls[0]), /ZXhhY3Qgb3V0Z29pbmcgYnl0ZXM=/);
});
