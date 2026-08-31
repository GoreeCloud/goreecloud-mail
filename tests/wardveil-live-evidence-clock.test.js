import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { AttachmentDeliveryService } from '../server/attachment-delivery-service.js';
import { GmailOutgoingAttachmentSecurityGate } from '../server/gmail-outgoing-attachment-security.js';

const DELAY_MS = 25;
const CLEAN_BYTES = Buffer.from('GoreeCloud live Wardveil clock control\n', 'utf8');

async function delayedCleanEnvelope({ resourceId, bytes }) {
  await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
  const observedAt = new Date();
  const digest = createHash('sha256').update(bytes).digest('hex');
  return {
    resource_id: resourceId,
    resource_digest_sha256: digest,
    scan_record: {
      contract_version: '0.1.0',
      record_id: `live-clock-${createHash('sha256').update(resourceId).digest('hex').slice(0, 16)}`,
      record_type: 'scan_finding',
      correlation_id: `live-clock-${createHash('sha256').update(`${resourceId}:correlation`).digest('hex').slice(0, 16)}`,
      producer: { id: 'wardveil-scan', authoritative: true },
      scope: { resource_type: 'mail_attachment', resource_id: resourceId },
      observed_at: observedAt.toISOString(),
      valid_until: new Date(observedAt.getTime() + 60_000).toISOString(),
      result: 'clean',
      evidence_refs: ['wardveil:runtime:live-clock-control'],
    },
  };
}

async function withTempDir(prefix, run) {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), prefix));
  try {
    return await run(rootDir);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
}

test('incoming delivery validates default-time Wardveil evidence after the live scan completes', async () => {
  await withTempDir('goreecloud-mail-live-clock-incoming-', async (rootDir) => {
    const service = new AttachmentDeliveryService({
      gmailAccountService: {
        async getAttachment({ attachmentId }) {
          return {
            attachmentId,
            size: CLEAN_BYTES.length,
            bytes: Buffer.from(CLEAN_BYTES),
          };
        },
      },
      wardveilScanClient: {
        async scanAttachment({ messageId, attachmentId, bytes }) {
          return delayedCleanEnvelope({
            resourceId: `mail:${messageId}:attachment:${attachmentId}`,
            bytes,
          });
        },
      },
      rootDir,
    });

    const result = await service.retrieveGmailAttachment({
      session: { userId: 'user-live-clock' },
      accountId: 'account-live-clock',
      messageId: 'message-live-clock',
      attachmentId: 'attachment-live-clock',
      metadata: { filename: 'clock.txt', mimeType: 'text/plain' },
      maxBytes: 1024,
    });

    assert.equal(result.wardveil.result, 'clean');
    assert.equal(result.wardveil.producerId, 'wardveil-scan');

    const authorized = service.authorizeDownload({
      session: { userId: 'user-live-clock' },
      objectId: result.objectId,
    });
    assert.equal(authorized.wardveil.result, 'clean');

    await service.remove({
      session: { userId: 'user-live-clock' },
      objectId: result.objectId,
    });
  });
});

test('outgoing gate validates default-time Wardveil evidence after the live scan completes', async () => {
  await withTempDir('goreecloud-mail-live-clock-outgoing-', async (rootDir) => {
    const gate = new GmailOutgoingAttachmentSecurityGate({
      wardveilScanClient: {
        async scan({ resourceId, bytes }) {
          return delayedCleanEnvelope({ resourceId, bytes });
        },
      },
      provenanceRootDir: rootDir,
    });

    const result = await gate.authorize({
      accountId: 'account-live-clock',
      action: 'send',
      message: {
        to: 'runtime@example.invalid',
        subject: 'Live Wardveil clock control',
        body: 'Clock control.',
        clientMutationId: 'live-clock-send',
        attachments: [
          {
            filename: 'clock.txt',
            contentType: 'text/plain',
            contentBase64: CLEAN_BYTES.toString('base64'),
          },
        ],
      },
    });

    assert.equal(result.scans.length, 1);
    assert.equal(result.scans[0].result, 'clean');
    assert.equal(result.provenance.persisted, true);
    assert.deepEqual(result.message.attachments[0].bytes, CLEAN_BYTES);
  });
});
