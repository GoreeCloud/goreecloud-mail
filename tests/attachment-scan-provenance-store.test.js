import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  AttachmentScanProvenanceError,
  persistWardveilScanProvenance,
  readWardveilScanProvenance,
  removeWardveilScanProvenance,
  wardveilScanProvenancePath,
} from '../server/attachment-scan-provenance-store.js';

async function withTempDir(fn) {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'goreecloud-mail-scan-provenance-'));
  try { await fn(rootDir); } finally { await rm(rootDir, { recursive: true, force: true }); }
}

function cleanProvenance(overrides = {}) {
  return {
    result: 'clean',
    recordId: 'scan-record-1',
    correlationId: 'mail-correlation-1',
    producerId: 'wardveil-scan',
    observedAt: '2026-08-29T10:59:00.000Z',
    validUntil: '2026-08-29T11:10:00.000Z',
    digestSha256: 'a'.repeat(64),
    evidenceRefs: ['wardveil:evidence:1'],
    ...overrides,
  };
}

test('durable Wardveil scan provenance round trips with restrictive file mode', async () => {
  await withTempDir(async (rootDir) => {
    const persisted = await persistWardveilScanProvenance({ rootDir, objectId: 'object-1', provenance: cleanProvenance() });
    assert.equal(persisted.result, 'clean');

    const filePath = wardveilScanProvenancePath({ rootDir, objectId: 'object-1' });
    const fileStat = await stat(filePath);
    assert.equal(fileStat.mode & 0o777, 0o600);

    const restored = readWardveilScanProvenance({ rootDir, objectId: 'object-1' });
    assert.deepEqual(restored, cleanProvenance());
  });
});

test('provenance sidecar contains minimized security metadata rather than raw attachment content or secrets', async () => {
  await withTempDir(async (rootDir) => {
    await persistWardveilScanProvenance({ rootDir, objectId: 'object-1', provenance: cleanProvenance() });
    const encoded = await readFile(wardveilScanProvenancePath({ rootDir, objectId: 'object-1' }), 'utf8');
    assert.match(encoded, /scan-record-1/);
    assert.match(encoded, /wardveil:evidence:1/);
    assert.ok(!encoded.includes('raw_attachment_bytes'));
    assert.ok(!encoded.includes('provider_access_token'));
    assert.ok(!encoded.includes('wardveil_caller_secret'));
  });
});

test('provenance store rejects non-clean state and invalid validity windows', async () => {
  await withTempDir(async (rootDir) => {
    await assert.rejects(
      () => persistWardveilScanProvenance({ rootDir, objectId: 'object-1', provenance: cleanProvenance({ result: 'malicious' }) }),
      AttachmentScanProvenanceError,
    );
    await assert.rejects(
      () => persistWardveilScanProvenance({
        rootDir,
        objectId: 'object-2',
        provenance: cleanProvenance({ observedAt: '2026-08-29T11:10:00.000Z', validUntil: '2026-08-29T11:00:00.000Z' }),
      }),
      AttachmentScanProvenanceError,
    );
  });
});

test('provenance tampering fails integrity verification', async () => {
  await withTempDir(async (rootDir) => {
    await persistWardveilScanProvenance({ rootDir, objectId: 'object-1', provenance: cleanProvenance() });
    const filePath = wardveilScanProvenancePath({ rootDir, objectId: 'object-1' });
    const parsed = JSON.parse(await readFile(filePath, 'utf8'));
    parsed.provenance.valid_until = '2099-01-01T00:00:00.000Z';
    await writeFile(filePath, `${JSON.stringify(parsed)}\n`, { mode: 0o600 });
    assert.throws(
      () => readWardveilScanProvenance({ rootDir, objectId: 'object-1' }),
      /integrity verification failed/,
    );
  });
});

test('missing provenance is distinguishable and removal clears the durable sidecar', async () => {
  await withTempDir(async (rootDir) => {
    assert.throws(
      () => readWardveilScanProvenance({ rootDir, objectId: 'missing-object' }),
      (error) => error instanceof AttachmentScanProvenanceError && error.code === 'wardveil-scan-provenance-missing',
    );

    await persistWardveilScanProvenance({ rootDir, objectId: 'object-1', provenance: cleanProvenance() });
    await removeWardveilScanProvenance({ rootDir, objectId: 'object-1' });
    assert.throws(
      () => readWardveilScanProvenance({ rootDir, objectId: 'object-1' }),
      (error) => error.code === 'wardveil-scan-provenance-missing',
    );
  });
});
