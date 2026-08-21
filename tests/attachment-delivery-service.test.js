import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { AttachmentDeliveryService } from '../server/attachment-delivery-service.js';

async function withTempDir(fn) {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'goreecloud-mail-attachment-delivery-'));
  try { await fn(rootDir); } finally { await rm(rootDir, { recursive: true, force: true }); }
}

function buildGmailAccountService(calls) {
  return {
    async getAttachment(args) {
      calls.push(args);
      if (args.session?.userId !== 'user-a' || args.accountId !== 'account-a') {
        const error = new Error('provider account not found');
        error.code = 'provider-account-not-found';
        error.status = 404;
        throw error;
      }
      return {
        attachmentId: args.attachmentId,
        size: 8,
        bytes: Buffer.from('%PDF-x\n', 'ascii'),
      };
    },
  };
}

test('retrieval binds stored attachment to authenticated user and account', async () => {
  await withTempDir(async (rootDir) => {
    const calls = [];
    const service = new AttachmentDeliveryService({
      gmailAccountService: buildGmailAccountService(calls),
      rootDir,
    });

    const result = await service.retrieveGmailAttachment({
      session: { userId: 'user-a' },
      accountId: 'account-a',
      messageId: 'message-1',
      attachmentId: 'attachment-1',
      metadata: { filename: '../../invoice.pdf', mimeType: 'application/pdf' },
    });

    assert.equal(calls.length, 1);
    assert.equal(result.accountId, 'account-a');
    assert.equal(result.messageId, 'message-1');
    assert.equal(result.attachmentId, 'attachment-1');
    assert.equal(result.size, 8);
    assert.equal(result.sniffedMimeType, 'application/pdf');
    assert.ok(!('path' in result));
    assert.ok(!('userId' in result));

    const download = service.authorizeDownload({ session: { userId: 'user-a' }, objectId: result.objectId });
    assert.equal(download.headers['Content-Type'], 'application/octet-stream');
    assert.match(download.headers['Content-Disposition'], /^attachment;/);
    assert.equal(download.headers['X-Content-Type-Options'], 'nosniff');
    assert.ok(download.path.startsWith(rootDir));
  });
});

test('knowing another user attachment object id does not authorize delivery', async () => {
  await withTempDir(async (rootDir) => {
    const service = new AttachmentDeliveryService({
      gmailAccountService: buildGmailAccountService([]),
      rootDir,
    });
    const stored = await service.retrieveGmailAttachment({
      session: { userId: 'user-a' },
      accountId: 'account-a',
      messageId: 'message-1',
      attachmentId: 'attachment-1',
      metadata: { filename: 'invoice.pdf', mimeType: 'application/pdf' },
    });

    assert.throws(
      () => service.authorizeDownload({ session: { userId: 'user-b' }, objectId: stored.objectId }),
      (error) => error.code === 'not-found' && error.status === 404,
    );
  });
});

test('removal is ownership-scoped and invalidates later download authorization', async () => {
  await withTempDir(async (rootDir) => {
    const service = new AttachmentDeliveryService({
      gmailAccountService: buildGmailAccountService([]),
      rootDir,
    });
    const stored = await service.retrieveGmailAttachment({
      session: { userId: 'user-a' },
      accountId: 'account-a',
      messageId: 'message-1',
      attachmentId: 'attachment-1',
      metadata: { filename: 'invoice.pdf', mimeType: 'application/pdf' },
    });

    await assert.rejects(
      () => service.remove({ session: { userId: 'user-b' }, objectId: stored.objectId }),
      (error) => error.code === 'not-found' && error.status === 404,
    );
    assert.equal(await service.remove({ session: { userId: 'user-a' }, objectId: stored.objectId }), true);
    assert.throws(
      () => service.authorizeDownload({ session: { userId: 'user-a' }, objectId: stored.objectId }),
      (error) => error.code === 'not-found' && error.status === 404,
    );
  });
});
