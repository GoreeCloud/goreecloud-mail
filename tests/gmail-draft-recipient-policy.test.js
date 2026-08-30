import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { GmailAccountService } from '../server/gmail-account-service.js';
import { GmailOutgoingAttachmentSecurityGate } from '../server/gmail-outgoing-attachment-security.js';
import { buildGmailRawMessage, decodeGmailRawMessage } from '../server/gmail-message-builder.js';

test('Gmail MIME keeps recipients mandatory by default but permits recipient-less draft composition explicitly', () => {
  assert.throws(
    () => buildGmailRawMessage({ subject: 'Send still needs a recipient', body: 'Body' }),
    (error) => error.code === 'invalid-request' && error.status === 400,
  );

  const draft = buildGmailRawMessage(
    { subject: 'Unfinished draft', body: 'Recipient can be chosen later.' },
    { recipientRequired: false },
  );
  const decoded = decodeGmailRawMessage(draft.raw);
  assert.equal(draft.recipientCount, 0);
  assert.doesNotMatch(decoded, /^To:/m);
  assert.match(decoded, /^Subject: Unfinished draft\r$/m);
});

test('GmailAccountService creates recipient-less drafts but still rejects recipient-less sends before client creation', async () => {
  let clientCreations = 0;
  const draftWrites = [];
  const service = new GmailAccountService({
    accountService: {
      get: () => ({ id: 'account-a', provider: 'gmail' }),
      requireCapabilities: async () => {},
    },
    gmailClientFactory: () => {
      clientCreations += 1;
      return {
        createDraft: async (_context, { raw }) => {
          draftWrites.push(raw);
          return { id: 'draft-1', message: { id: 'message-1' } };
        },
        sendMessage: async () => ({ id: 'sent-1' }),
      };
    },
  });

  const draft = await service.createDraft({
    session: { userId: 'user-a' },
    accountId: 'account-a',
    message: { subject: 'Unfinished', body: 'No recipient yet.' },
  });
  assert.equal(draft.id, 'draft-1');
  assert.equal(draftWrites.length, 1);
  assert.doesNotMatch(decodeGmailRawMessage(draftWrites[0]), /^To:/m);

  const beforeSendCreations = clientCreations;
  await assert.rejects(
    () => service.send({
      session: { userId: 'user-a' },
      accountId: 'account-a',
      message: { subject: 'Not sendable', body: 'No recipient.' },
    }),
    (error) => error.code === 'invalid-request' && error.status === 400,
  );
  assert.equal(clientCreations, beforeSendCreations);
});

test('recipient-less attachment drafts still cross the exact-byte Wardveil authorization boundary', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'goreecloud-mail-draft-recipient-policy-'));
  try {
    const scanCalls = [];
    const gate = new GmailOutgoingAttachmentSecurityGate({
      provenanceRootDir: rootDir,
      wardveilScanClient: {
        async scan(args) {
          scanCalls.push({ ...args, bytes: Buffer.from(args.bytes) });
          const digest = createHash('sha256').update(args.bytes).digest('hex');
          const now = Date.now();
          return {
            resource_id: args.resourceId,
            resource_digest_sha256: digest,
            scan_record: {
              contract_version: '0.1.0',
              record_id: 'recipientless-draft-clean-1',
              record_type: 'scan_finding',
              correlation_id: 'recipientless-draft-correlation-1',
              producer: { id: 'wardveil-scan', authoritative: true },
              scope: { resource_type: 'mail_attachment', resource_id: args.resourceId },
              observed_at: new Date(now - 1_000).toISOString(),
              valid_until: new Date(now + 60_000).toISOString(),
              result: 'clean',
              evidence_refs: ['wardveil:evidence:recipientless-draft-1'],
            },
          };
        },
      },
    });

    const result = await gate.authorize({
      accountId: 'account-a',
      action: 'draft',
      message: {
        subject: 'Attachment first',
        body: 'Recipient later.',
        attachments: [{
          filename: 'notes.txt',
          contentType: 'text/plain',
          contentBase64: Buffer.from('exact draft bytes').toString('base64'),
        }],
      },
    });

    assert.equal(scanCalls.length, 1);
    assert.equal(scanCalls[0].action, 'draft');
    assert.deepEqual(scanCalls[0].bytes, Buffer.from('exact draft bytes'));
    assert.equal(result.message.attachments.length, 1);
    assert.equal(result.provenance.persisted, true);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
