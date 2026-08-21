import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { CredentialNotFoundError } from './credential-vault.js';

const FORMAT_VERSION = 1;
const ALGORITHM = 'aes-256-gcm';

function requireText(name, value) {
  if (typeof value !== 'string' || value.length === 0) throw new TypeError(`${name} is required`);
}

function parseKey(key) {
  if (Buffer.isBuffer(key)) {
    if (key.length !== 32) throw new TypeError('encryptionKey must be exactly 32 bytes');
    return Buffer.from(key);
  }
  requireText('encryptionKey', key);
  const decoded = Buffer.from(key, 'base64');
  if (decoded.length !== 32) throw new TypeError('encryptionKey must decode to exactly 32 bytes');
  return decoded;
}

function entryKey(userId, accountId) {
  return `${userId}\u0000${accountId}`;
}

/**
 * Encrypted credential-vault adapter for controlled self-hosted deployment.
 *
 * The encryption key must be supplied by trusted runtime configuration and must
 * never be written to the vault file. The vault persists only authenticated
 * ciphertext using AES-256-GCM. Application SQLite state stores only a vault
 * reference, never these provider secret values.
 */
export class EncryptedFileCredentialVault {
  #path;
  #key;
  #entries;

  constructor({ path, encryptionKey }) {
    requireText('path', path);
    this.#path = path;
    this.#key = parseKey(encryptionKey);
    this.#entries = this.#load();
  }

  put({ userId, accountId, provider, secret }) {
    requireText('userId', userId);
    requireText('accountId', accountId);
    requireText('provider', provider);
    if (!secret || typeof secret !== 'object' || Array.isArray(secret)) throw new TypeError('secret is required');

    const updatedAt = new Date().toISOString();
    this.#entries[entryKey(userId, accountId)] = {
      userId,
      accountId,
      provider,
      secret: structuredClone(secret),
      updatedAt,
    };
    this.#persist();
    return this.describe({ userId, accountId });
  }

  get({ userId, accountId }) {
    const entry = this.#find(userId, accountId);
    return structuredClone(entry.secret);
  }

  describe({ userId, accountId }) {
    const entry = this.#find(userId, accountId);
    return Object.freeze({
      accountId: entry.accountId,
      provider: entry.provider,
      updatedAt: entry.updatedAt,
      configured: true,
    });
  }

  remove({ userId, accountId }) {
    const key = entryKey(userId, accountId);
    this.#find(userId, accountId);
    delete this.#entries[key];
    this.#persist();
    return { removed: true };
  }

  rotateEncryptionKey({ encryptionKey }) {
    const nextKey = parseKey(encryptionKey);
    this.#persist(nextKey);
    this.#key = nextKey;
    return { rotated: true };
  }

  #find(userId, accountId) {
    requireText('userId', userId);
    requireText('accountId', accountId);
    const entry = this.#entries[entryKey(userId, accountId)];
    if (!entry) throw new CredentialNotFoundError();
    return entry;
  }

  #load() {
    if (!existsSync(this.#path)) return Object.create(null);
    const envelope = JSON.parse(readFileSync(this.#path, 'utf8'));
    if (envelope.version !== FORMAT_VERSION || envelope.algorithm !== ALGORITHM) {
      throw new Error('Credential vault format is unsupported.');
    }

    const iv = Buffer.from(envelope.iv, 'base64');
    const tag = Buffer.from(envelope.tag, 'base64');
    const ciphertext = Buffer.from(envelope.ciphertext, 'base64');
    const decipher = createDecipheriv(ALGORITHM, this.#key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const parsed = JSON.parse(plaintext.toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Credential vault payload is invalid.');
    return parsed;
  }

  #persist(encryptionKey = this.#key) {
    mkdirSync(dirname(this.#path), { recursive: true, mode: 0o700 });
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, encryptionKey, iv);
    const plaintext = Buffer.from(JSON.stringify(this.#entries), 'utf8');
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const envelope = JSON.stringify({
      version: FORMAT_VERSION,
      algorithm: ALGORITHM,
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      ciphertext: ciphertext.toString('base64'),
    });

    const temporaryPath = `${this.#path}.tmp`;
    writeFileSync(temporaryPath, envelope, { encoding: 'utf8', mode: 0o600 });
    chmodSync(temporaryPath, 0o600);
    renameSync(temporaryPath, this.#path);
    chmodSync(this.#path, 0o600);
  }
}
