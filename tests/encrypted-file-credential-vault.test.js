import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { EncryptedFileCredentialVault } from '../server/encrypted-file-credential-vault.js';
import { CredentialNotFoundError } from '../server/credential-vault.js';

const KEY = Buffer.alloc(32, 7);
const ROTATED_KEY = Buffer.alloc(32, 9);

function withVault(callback) {
  const dir = mkdtempSync(join(tmpdir(), 'goreecloud-mail-vault-'));
  const path = join(dir, 'provider-credentials.vault');
  try {
    return callback({ path });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('encrypted credential vault persists provider secrets without plaintext disclosure', () => {
  withVault(({ path }) => {
    let vault = new EncryptedFileCredentialVault({ path, encryptionKey: KEY });
    vault.put({
      userId: 'user-a',
      accountId: 'account-a',
      provider: 'gmail',
      secret: { refreshToken: 'refresh-secret-value', accessToken: 'access-secret-value' },
    });

    const raw = readFileSync(path, 'utf8');
    assert.doesNotMatch(raw, /refresh-secret-value|access-secret-value|user-a|account-a/);
    assert.equal(statSync(path).mode & 0o777, 0o600);

    vault = new EncryptedFileCredentialVault({ path, encryptionKey: KEY });
    assert.deepEqual(vault.get({ userId: 'user-a', accountId: 'account-a' }), {
      refreshToken: 'refresh-secret-value',
      accessToken: 'access-secret-value',
    });
  });
});

test('encrypted credential vault remains user and account scoped', () => {
  withVault(({ path }) => {
    const vault = new EncryptedFileCredentialVault({ path, encryptionKey: KEY });
    vault.put({ userId: 'user-a', accountId: 'account-a', provider: 'gmail', secret: { token: 'one' } });
    assert.throws(() => vault.get({ userId: 'user-b', accountId: 'account-a' }), CredentialNotFoundError);
    assert.throws(() => vault.get({ userId: 'user-a', accountId: 'account-b' }), CredentialNotFoundError);
  });
});

test('encrypted credential vault fails authentication with the wrong encryption key', () => {
  withVault(({ path }) => {
    const vault = new EncryptedFileCredentialVault({ path, encryptionKey: KEY });
    vault.put({ userId: 'user-a', accountId: 'account-a', provider: 'gmail', secret: { token: 'one' } });
    assert.throws(() => new EncryptedFileCredentialVault({ path, encryptionKey: Buffer.alloc(32, 8) }));
  });
});

test('encrypted credential vault rotates encryption keys without exposing provider secrets', () => {
  withVault(({ path }) => {
    const vault = new EncryptedFileCredentialVault({ path, encryptionKey: KEY });
    vault.put({
      userId: 'user-a',
      accountId: 'account-a',
      provider: 'gmail',
      secret: { refreshToken: 'rotation-secret' },
    });

    assert.deepEqual(vault.rotateEncryptionKey({ encryptionKey: ROTATED_KEY }), { rotated: true });
    assert.equal(statSync(path).mode & 0o777, 0o600);
    assert.doesNotMatch(readFileSync(path, 'utf8'), /rotation-secret|user-a|account-a/);
    assert.throws(() => new EncryptedFileCredentialVault({ path, encryptionKey: KEY }));

    const reopened = new EncryptedFileCredentialVault({ path, encryptionKey: ROTATED_KEY });
    assert.deepEqual(reopened.get({ userId: 'user-a', accountId: 'account-a' }), {
      refreshToken: 'rotation-secret',
    });
  });
});

test('encrypted credential descriptors omit secret material and remove persists', () => {
  withVault(({ path }) => {
    let vault = new EncryptedFileCredentialVault({ path, encryptionKey: KEY });
    const description = vault.put({ userId: 'user-a', accountId: 'account-a', provider: 'gmail', secret: { refreshToken: 'hidden' } });
    assert.equal(description.configured, true);
    assert.equal(description.provider, 'gmail');
    assert.doesNotMatch(JSON.stringify(description), /hidden|refreshToken/);
    vault.remove({ userId: 'user-a', accountId: 'account-a' });

    vault = new EncryptedFileCredentialVault({ path, encryptionKey: KEY });
    assert.throws(() => vault.get({ userId: 'user-a', accountId: 'account-a' }), CredentialNotFoundError);
  });
});
