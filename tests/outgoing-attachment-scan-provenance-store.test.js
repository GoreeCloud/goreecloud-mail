import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  OutgoingAttachmentScanProvenanceError,
  outgoingWardveilScanProvenancePath,
  persistOutgoingWardveilScanProvenance,
  readOutgoingWardveilScanProvenance,
} from '../server/outgoing-attachment-scan-provenance-store.js';

function cleanScan() {
  return {
    result: 'clean',
    recordId: 'outgoing-clean-1',
    correlationId: 'mail-outgoing-correlation-1',
    producerId: 'wardveil-scan',
    observedAt: '2026-08-29T20:29:00.000Z',
    validUntil: '2026-08-29T20:40:00.000Z',
    digestSha256: createHash('sha256').update('exact outgoing bytes', 'utf8').digest('hex'),
    resourceId: `mail:outgoing:${'b'.repeat(64)}`,
    evidenceRefs: ['wardveil:evidence:outgoing-1'],
  };
}

async function withRoot(run) {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'goreecloud-mail-outgoing-provenance-'));
  try {
    return await run(rootDir);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
}

test('outgoing provenance round trips with restrictive file mode', async () => withRoot(async (rootDir) => {
  const operationId = 'a'.repeat(64);
  const persisted = await persistOutgoingWardveilScanProvenance({
    rootDir,
    operationId,
    action: 'send',
    scans: [cleanScan()],
  });

  assert.equal(persisted.operationId, operationId);
  assert.equal(persisted.action, 'send');
  assert.equal(persisted.scans.length, 1);

  const filePath = outgoingWardveilScanProvenancePath({ rootDir, operationId });
  const mode = (await stat(filePath)).mode & 0o777;
  assert.equal(mode, 0o600);

  const restored = readOutgoingWardveilScanProvenance({ rootDir, operationId });
  assert.equal(restored.operationId, operationId);
  assert.equal(restored.action, 'send');
  assert.deepEqual(restored.scans[0], cleanScan());
}));

test('outgoing provenance contains minimized security metadata rather than attachment content, names, account ids, or secrets', async () => withRoot(async (rootDir) => {
  const operationId = 'c'.repeat(64);
  await persistOutgoingWardveilScanProvenance({
    rootDir,
    operationId,
    action: 'draft',
    scans: [cleanScan()],
  });

  const encoded = await readFile(
    outgoingWardveilScanProvenancePath({ rootDir, operationId }),
    'utf8',
  );
  assert.match(encoded, /outgoing-clean-1/);
  assert.match(encoded, /wardveil:evidence:outgoing-1/);
  assert.doesNotMatch(encoded, /exact outgoing bytes/);
  assert.doesNotMatch(encoded, /report\.txt/);
  assert.doesNotMatch(encoded, /account-a/);
  assert.doesNotMatch(encoded, /recipient@example\.test/);
  assert.doesNotMatch(encoded, /wardveil-secret/);
}));

test('outgoing provenance rejects non-clean state', async () => withRoot(async (rootDir) => {
  await assert.rejects(
    () => persistOutgoingWardveilScanProvenance({
      rootDir,
      operationId: 'd'.repeat(64),
      action: 'send',
      scans: [{ ...cleanScan(), result: 'malicious' }],
    }),
    (error) => error instanceof OutgoingAttachmentScanProvenanceError,
  );
}));

test('outgoing provenance tampering fails integrity verification', async () => withRoot(async (rootDir) => {
  const operationId = 'e'.repeat(64);
  await persistOutgoingWardveilScanProvenance({
    rootDir,
    operationId,
    action: 'send',
    scans: [cleanScan()],
  });
  const filePath = outgoingWardveilScanProvenancePath({ rootDir, operationId });
  const envelope = JSON.parse(await readFile(filePath, 'utf8'));
  envelope.provenance.scans[0].producer_id = 'tampered-producer';
  await writeFile(filePath, `${JSON.stringify(envelope)}\n`, 'utf8');

  assert.throws(
    () => readOutgoingWardveilScanProvenance({ rootDir, operationId }),
    (error) =>
      error instanceof OutgoingAttachmentScanProvenanceError &&
      /integrity verification failed/i.test(error.message),
  );
}));

test('missing outgoing provenance is distinguishable', async () => withRoot(async (rootDir) => {
  assert.throws(
    () => readOutgoingWardveilScanProvenance({ rootDir, operationId: 'f'.repeat(64) }),
    (error) =>
      error instanceof OutgoingAttachmentScanProvenanceError &&
      error.code === 'outgoing-wardveil-scan-provenance-missing',
  );
}));
