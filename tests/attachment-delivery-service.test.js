import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  ATTACHMENT_SECURITY_CODES,
  AttachmentDeliveryService,
} from '../server/attachment-delivery-service.js';

const TEST_NOW = Date.parse('2026-08-29T11:00:00.000Z');

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

function buildWardveilScanClient(calls, {
  result = 'clean',
  observedAt = '2026-08-29T10:59:00.000Z',
  validUntil = '2026-08-29T11:10:00.000Z',
  authoritative = true,
  evidenceRefs = ['wardveil:scan:evidence-1'],
  digestOverride = null,
  throwError = null,
} = {}) {
  return {
    async scanAttachment(args) {
      calls.push({ ...args, bytes: Buffer.from(args.bytes) });
      if (throwError) throw throwError;
      const resourceId = `mail:${args.messageId}:attachment:${args.attachmentId}`;
      const digest = digestOverride ?? createHash('sha256').update(args.bytes).digest('hex');
      return {
        resource_id: resourceId,
        resource_digest_sha256: digest,
        scan_record: {
          contract_version: '0.1.0',
          record_id: `scan-${result}-1`,
          record_type: 'scan_finding',
          correlation_id: 'mail-scan-correlation-1',
          producer: { id: 'wardveil-scan', authoritative },
          scope: { resource_type: 'mail_attachment', resource_id: resourceId },
          observed_at: observedAt,
          valid_until: validUntil,
          result,
          evidence_refs: evidenceRefs,
        },
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

function buildService({ rootDir, gmailCalls = [], scanCalls = [], stateStore = null, scanOptions = {}, storeFn } = {}) {
  return new AttachmentDeliveryService({
    gmailAccountService: buildGmailAccountService(gmailCalls),
    wardveilScanClient: buildWardveilScanClient(scanCalls, scanOptions),
    rootDir,
    stateStore,
    storeFn,
  });
}

test('attachment delivery requires a Wardveil Scan client', async () => {
  await withTempDir(async (rootDir) => {
    assert.throws(
      () => new AttachmentDeliveryService({ gmailAccountService: buildGmailAccountService([]), rootDir }),
      /wardveilScanClient/,
    );
  });
});

test('retrieval scans exact provider bytes before storing and binds clean evidence to delivery', async () => {
  await withTempDir(async (rootDir) => {
    const gmailCalls = [];
    const scanCalls = [];
    const service = buildService({ rootDir, gmailCalls, scanCalls });

    const result = await service.retrieveGmailAttachment({
      session: { userId: 'user-a' },
      accountId: 'account-a',
      messageId: 'message-1',
      attachmentId: 'attachment-1',
      metadata: { filename: '../../invoice.pdf', mimeType: 'application/pdf' },
      now: TEST_NOW,
    });

    assert.equal(gmailCalls.length, 1);
    assert.equal(scanCalls.length, 1);
    assert.equal(scanCalls[0].messageId, 'message-1');
    assert.equal(scanCalls[0].attachmentId, 'attachment-1');
    assert.equal(scanCalls[0].action, 'download');
    assert.deepEqual(scanCalls[0].bytes, Buffer.from('%PDF-x\n', 'ascii'));
    assert.equal(result.accountId, 'account-a');
    assert.equal(result.messageId, 'message-1');
    assert.equal(result.attachmentId, 'attachment-1');
    assert.equal(result.size, 7);
    assert.equal(result.sniffedMimeType, 'application/pdf');
    assert.equal(result.wardveil.result, 'clean');
    assert.equal(result.wardveil.scanRecordId, 'scan-clean-1');
    assert.ok(!('path' in result));
    assert.ok(!('userId' in result));

    const download = service.authorizeDownload({
      session: { userId: 'user-a' },
      objectId: result.objectId,
      now: TEST_NOW + 30_000,
    });
    assert.equal(download.wardveil.result, 'clean');
    assert.equal(download.headers['Content-Type'], 'application/octet-stream');
    assert.match(download.headers['Content-Disposition'], /^attachment;/);
    assert.equal(download.headers['X-Content-Type-Options'], 'nosniff');
    assert.ok(download.path.startsWith(rootDir));
  });
});

test('malicious Wardveil result blocks storage and returns non-destructive quarantine decision', async () => {
  await withTempDir(async (rootDir) => {
    const service = buildService({ rootDir, scanOptions: { result: 'malicious' } });
    await assert.rejects(
      () => service.retrieveGmailAttachment({
        session: { userId: 'user-a' }, accountId: 'account-a', messageId: 'message-1', attachmentId: 'attachment-1',
        metadata: { filename: 'invoice.pdf', mimeType: 'application/pdf' }, now: TEST_NOW,
      }),
      (error) => {
        assert.equal(error.code, ATTACHMENT_SECURITY_CODES.SCAN_BLOCKED);
        assert.equal(error.decision.disposition, 'block_quarantine');
        assert.equal(error.decision.quarantineRequired, true);
        assert.equal(error.decision.canDownload, false);
        assert.deepEqual(error.decision.evidenceRefs, ['wardveil:scan:evidence-1']);
        return true;
      },
    );
    assert.deepEqual(await readdir(rootDir), []);
  });
});

test('suspicious, unknown, and unsupported Wardveil results never create downloadable cache objects', async () => {
  for (const result of ['suspicious', 'unknown', 'unsupported']) {
    await withTempDir(async (rootDir) => {
      const service = buildService({ rootDir, scanOptions: { result } });
      await assert.rejects(
        () => service.retrieveGmailAttachment({
          session: { userId: 'user-a' }, accountId: 'account-a', messageId: 'message-1', attachmentId: 'attachment-1',
          metadata: { filename: 'invoice.pdf', mimeType: 'application/pdf' }, now: TEST_NOW,
        }),
        (error) => error.code === (result === 'suspicious' ? ATTACHMENT_SECURITY_CODES.SCAN_HELD : ATTACHMENT_SECURITY_CODES.SCAN_INVALID),
      );
      assert.deepEqual(await readdir(rootDir), []);
    });
  }
});

test('scanner transport failure fails closed before storage', async () => {
  await withTempDir(async (rootDir) => {
    const service = buildService({ rootDir, scanOptions: { throwError: new Error('simulated scanner timeout') } });
    await assert.rejects(
      () => service.retrieveGmailAttachment({
        session: { userId: 'user-a' }, accountId: 'account-a', messageId: 'message-1', attachmentId: 'attachment-1',
        metadata: { filename: 'invoice.pdf', mimeType: 'application/pdf' }, now: TEST_NOW,
      }),
      (error) => error.code === ATTACHMENT_SECURITY_CODES.SCAN_UNAVAILABLE && error.retryable === true && !/simulated scanner timeout/.test(error.message),
    );
    assert.deepEqual(await readdir(rootDir), []);
  });
});

test('expired clean Wardveil evidence fails closed before storage', async () => {
  await withTempDir(async (rootDir) => {
    const service = buildService({
      rootDir,
      scanOptions: { validUntil: '2026-08-29T10:59:30.000Z' },
    });
    await assert.rejects(
      () => service.retrieveGmailAttachment({
        session: { userId: 'user-a' }, accountId: 'account-a', messageId: 'message-1', attachmentId: 'attachment-1',
        metadata: { filename: 'invoice.pdf', mimeType: 'application/pdf' }, now: TEST_NOW,
      }),
      (error) => error.code === ATTACHMENT_SECURITY_CODES.SCAN_EXPIRED,
    );
    assert.deepEqual(await readdir(rootDir), []);
  });
});

test('scan digest mismatch fails closed before storage', async () => {
  await withTempDir(async (rootDir) => {
    const service = buildService({ rootDir, scanOptions: { digestOverride: '0'.repeat(64) } });
    await assert.rejects(
      () => service.retrieveGmailAttachment({
        session: { userId: 'user-a' }, accountId: 'account-a', messageId: 'message-1', attachmentId: 'attachment-1',
        metadata: { filename: 'invoice.pdf', mimeType: 'application/pdf' }, now: TEST_NOW,
      }),
      (error) => error.code === ATTACHMENT_SECURITY_CODES.SCAN_INVALID,
    );
    assert.deepEqual(await readdir(rootDir), []);
  });
});

test('content changed between scan and storage is rolled back', async () => {
  await withTempDir(async (rootDir) => {
    const service = buildService({
      rootDir,
      storeFn: async () => ({
        objectId: 'changed-object',
        path: path.join(rootDir, 'changed-object'),
        actualSize: 7,
        declaredSize: 7,
        sizeMismatch: false,
        declaredMimeType: 'application/pdf',
        sniffedMimeType: 'application/pdf',
        sha256: 'f'.repeat(64),
        executableDeclared: false,
      }),
    });
    await assert.rejects(
      () => service.retrieveGmailAttachment({
        session: { userId: 'user-a' }, accountId: 'account-a', messageId: 'message-1', attachmentId: 'attachment-1',
        metadata: { filename: 'invoice.pdf', mimeType: 'application/pdf' }, now: TEST_NOW,
      }),
      (error) => error.code === ATTACHMENT_SECURITY_CODES.CONTENT_CHANGED,
    );
  });
});

test('clean evidence expiry blocks a previously stored attachment', async () => {
  await withTempDir(async (rootDir) => {
    const service = buildService({
      rootDir,
      scanOptions: { validUntil: '2026-08-29T11:01:00.000Z' },
    });
    const stored = await service.retrieveGmailAttachment({
      session: { userId: 'user-a' }, accountId: 'account-a', messageId: 'message-1', attachmentId: 'attachment-1',
      metadata: { filename: 'invoice.pdf', mimeType: 'application/pdf' }, now: TEST_NOW,
    });
    assert.throws(
      () => service.authorizeDownload({ session: { userId: 'user-a' }, objectId: stored.objectId, now: TEST_NOW + 61_000 }),
      (error) => error.code === ATTACHMENT_SECURITY_CODES.SCAN_EXPIRED,
    );
  });
});

test('knowing another user attachment object id does not authorize delivery', async () => {
  await withTempDir(async (rootDir) => {
    const service = buildService({ rootDir });
    const stored = await service.retrieveGmailAttachment({
      session: { userId: 'user-a' }, accountId: 'account-a', messageId: 'message-1', attachmentId: 'attachment-1',
      metadata: { filename: 'invoice.pdf', mimeType: 'application/pdf' }, now: TEST_NOW,
    });

    assert.throws(
      () => service.authorizeDownload({ session: { userId: 'user-b' }, objectId: stored.objectId, now: TEST_NOW }),
      (error) => error.code === 'not-found' && error.status === 404,
    );
  });
});

test('removal is ownership-scoped and invalidates later download authorization', async () => {
  await withTempDir(async (rootDir) => {
    const service = buildService({ rootDir });
    const stored = await service.retrieveGmailAttachment({
      session: { userId: 'user-a' }, accountId: 'account-a', messageId: 'message-1', attachmentId: 'attachment-1',
      metadata: { filename: 'invoice.pdf', mimeType: 'application/pdf' }, now: TEST_NOW,
    });

    await assert.rejects(
      () => service.remove({ session: { userId: 'user-b' }, objectId: stored.objectId }),
      (error) => error.code === 'not-found' && error.status === 404,
    );
    assert.equal(await service.remove({ session: { userId: 'user-a' }, objectId: stored.objectId }), true);
    assert.throws(
      () => service.authorizeDownload({ session: { userId: 'user-a' }, objectId: stored.objectId, now: TEST_NOW }),
      (error) => error.code === 'not-found' && error.status === 404,
    );
  });
});

test('durable metadata survives service recreation but missing scan provenance fails closed', async () => {
  await withTempDir(async (rootDir) => {
    const stateStore = buildDurableState();
    let service = buildService({ rootDir, stateStore });
    const stored = await service.retrieveGmailAttachment({
      session: { userId: 'user-a' }, accountId: 'account-a', messageId: 'message-1', attachmentId: 'attachment-1',
      metadata: { filename: 'invoice.pdf', mimeType: 'application/pdf' }, now: TEST_NOW, ttlMs: 60_000,
    });

    assert.equal(stateStore.records.get(stored.objectId).path, undefined);
    const beforeRestart = service.authorizeDownload({
      session: { userId: 'user-a' }, objectId: stored.objectId, now: TEST_NOW + 30_000,
    });
    assert.equal(beforeRestart.objectId, stored.objectId);
    assert.equal(stateStore.records.get(stored.objectId).lastAccessedAt, '2026-08-29T11:00:30.000Z');

    service = buildService({ rootDir, stateStore });
    assert.throws(
      () => service.authorizeDownload({ session: { userId: 'user-a' }, objectId: stored.objectId, now: TEST_NOW + 31_000 }),
      (error) => error.code === ATTACHMENT_SECURITY_CODES.SCAN_PROVENANCE_MISSING,
    );
  });
});

test('expired durable attachments fail closed and cleanup removes bytes with metadata', async () => {
  await withTempDir(async (rootDir) => {
    const stateStore = buildDurableState();
    const service = buildService({ rootDir, stateStore });
    const stored = await service.retrieveGmailAttachment({
      session: { userId: 'user-a' }, accountId: 'account-a', messageId: 'message-1', attachmentId: 'attachment-1',
      metadata: { filename: 'invoice.pdf', mimeType: 'application/pdf' }, now: TEST_NOW, ttlMs: 1_000,
    });

    assert.throws(
      () => service.authorizeDownload({ session: { userId: 'user-a' }, objectId: stored.objectId, now: TEST_NOW + 2_000 }),
      (error) => error.code === 'not-found' && error.status === 404,
    );

    const cleanup = await service.cleanupExpired({ now: TEST_NOW + 2_000 });
    assert.deepEqual(cleanup, { removed: 1, remaining: 0 });
    assert.equal(stateStore.records.has(stored.objectId), false);
    await assert.rejects(() => access(path.join(rootDir, stored.objectId)));
  });
});

test('durable metadata failure rolls back newly stored attachment bytes and scan provenance', async () => {
  await withTempDir(async (rootDir) => {
    const stateStore = buildDurableState();
    stateStore.putAttachmentDeliveryRecord = () => { throw new Error('simulated persistence failure'); };
    const service = buildService({ rootDir, stateStore });

    await assert.rejects(
      () => service.retrieveGmailAttachment({
        session: { userId: 'user-a' }, accountId: 'account-a', messageId: 'message-1', attachmentId: 'attachment-1',
        metadata: { filename: 'invoice.pdf', mimeType: 'application/pdf' }, now: TEST_NOW,
      }),
      /simulated persistence failure/,
    );

    assert.deepEqual(await readdir(rootDir), []);
  });
});
