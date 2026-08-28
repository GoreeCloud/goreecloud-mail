import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, rm } from 'node:fs/promises';
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
      const bytes = Buffer.from('%PDF-x\n', 'ascii');
      return {
        attachmentId: args.attachmentId,
        size: bytes.length,
        bytes,
      };
    },
  };
}

function buildDurableState() {
  const records = new Map();
  return {
    putAttachmentDeliveryRecord(record) {
      records.set(record.objectId, { ...record, lastAccessedAt: null });
      return records.get(record.objectId);
    },
    getAttachmentDeliveryRecord({ userId, objectId }) {
      const record = records.get(objectId);
      if (!record || record.userId !== userId) throw new Error('not found');
      return { ...record };
    },
    touchAttachmentDeliveryRecord({ userId, objectId, accessedAt }) {
      const record = this.getAttachmentDeliveryRecord({ userId, objectId });
      records.set(objectId, { ...record, lastAccessedAt: accessedAt });
      return records.get(objectId);
    },
    removeAttachmentDeliveryRecord({ userId, objectId }) {
      this.getAttachmentDeliveryRecord({ userId, objectId });
      records.delete(objectId);
      return { removed: true };
    },
    listExpiredAttachmentDeliveryRecords({ now, limit }) {
      return [...records.values()]
        .filter((record) => record.expiresAt && record.expiresAt <= now)
        .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt) || a.objectId.localeCompare(b.objectId))
        .slice(0, limit)
        .map((record) => ({ ...record }));
    },
    records,
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
    assert.equal(result.size, 7);
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

test('durable metadata survives service recreation and records access without storing filesystem paths', async () => {
  await withTempDir(async (rootDir) => {
    const stateStore = buildDurableState();
    let service = new AttachmentDeliveryService({ gmailAccountService: buildGmailAccountService([]), rootDir, stateStore });
    const stored = await service.retrieveGmailAttachment({
      session: { userId: 'user-a' },
      accountId: 'account-a',
      messageId: 'message-1',
      attachmentId: 'attachment-1',
      metadata: { filename: 'invoice.pdf', mimeType: 'application/pdf' },
      now: Date.parse('2026-08-23T08:00:00.000Z'),
      ttlMs: 60_000,
    });

    assert.equal(stateStore.records.get(stored.objectId).path, undefined);
    service = new AttachmentDeliveryService({ gmailAccountService: buildGmailAccountService([]), rootDir, stateStore });
    const download = service.authorizeDownload({
      session: { userId: 'user-a' },
      objectId: stored.objectId,
      now: Date.parse('2026-08-23T08:00:30.000Z'),
    });
    assert.equal(download.objectId, stored.objectId);
    assert.equal(stateStore.records.get(stored.objectId).lastAccessedAt, '2026-08-23T08:00:30.000Z');
    assert.equal(download.path, path.join(rootDir, stored.objectId));
  });
});

test('expired durable attachments fail closed and cleanup removes bytes with metadata', async () => {
  await withTempDir(async (rootDir) => {
    const stateStore = buildDurableState();
    const service = new AttachmentDeliveryService({ gmailAccountService: buildGmailAccountService([]), rootDir, stateStore });
    const stored = await service.retrieveGmailAttachment({
      session: { userId: 'user-a' },
      accountId: 'account-a',
      messageId: 'message-1',
      attachmentId: 'attachment-1',
      metadata: { filename: 'invoice.pdf', mimeType: 'application/pdf' },
      now: Date.parse('2026-08-23T08:10:00.000Z'),
      ttlMs: 1_000,
    });

    assert.throws(
      () => service.authorizeDownload({
        session: { userId: 'user-a' },
        objectId: stored.objectId,
        now: Date.parse('2026-08-23T08:10:02.000Z'),
      }),
      (error) => error.code === 'not-found' && error.status === 404,
    );

    const cleanup = await service.cleanupExpired({ now: Date.parse('2026-08-23T08:10:02.000Z') });
    assert.deepEqual(cleanup, { removed: 1, remaining: 0 });
    assert.equal(stateStore.records.has(stored.objectId), false);
    await assert.rejects(() => access(path.join(rootDir, stored.objectId)));
  });
});

test('durable metadata failure rolls back newly stored attachment bytes', async () => {
  await withTempDir(async (rootDir) => {
    const stateStore = buildDurableState();
    stateStore.putAttachmentDeliveryRecord = () => { throw new Error('simulated persistence failure'); };
    const service = new AttachmentDeliveryService({ gmailAccountService: buildGmailAccountService([]), rootDir, stateStore });

    await assert.rejects(
      () => service.retrieveGmailAttachment({
        session: { userId: 'user-a' },
        accountId: 'account-a',
        messageId: 'message-1',
        attachmentId: 'attachment-1',
        metadata: { filename: 'invoice.pdf', mimeType: 'application/pdf' },
      }),
      /simulated persistence failure/,
    );

    const entries = await import('node:fs/promises').then(({ readdir }) => readdir(rootDir));
    assert.deepEqual(entries, []);
  });
});
