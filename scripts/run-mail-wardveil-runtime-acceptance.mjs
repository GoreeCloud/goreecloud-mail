#!/usr/bin/env node
import { lstat, mkdir, open, readFile } from 'node:fs/promises';
import path from 'node:path';

import { runMailWardveilRuntimeAcceptance } from '../server/mail-wardveil-runtime-acceptance.js';
import { WardveilScanClient } from '../server/wardveil-scan-client.js';

const DEFAULT_ENDPOINT = 'http://127.0.0.1:8791/v1/scan';
const DEFAULT_CALLER_ID = 'goreecloud-mail';
const DEFAULT_KEY_ID = 'scan-current';
const MAX_SECRET_BYTES = 4096;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }

  for (const name of ['secretFile', 'mailRevision', 'wardveilRevision', 'output']) {
    if (!args[name]) throw new TypeError(`--${toKebab(name)} is required`);
  }

  const secret = await readProtectedSecret(args.secretFile);
  const client = new WardveilScanClient({
    endpoint: args.endpoint ?? DEFAULT_ENDPOINT,
    callerId: args.callerId ?? DEFAULT_CALLER_ID,
    keyId: args.keyId ?? DEFAULT_KEY_ID,
    secret,
  });

  const evidence = await runMailWardveilRuntimeAcceptance({
    wardveilScanClient: client,
    mailRevision: args.mailRevision,
    wardveilRevision: args.wardveilRevision,
    wardveilEndpoint: String(client.endpoint),
  });

  await writeEvidenceExclusive(args.output, evidence);

  console.log('runtime_application_consumer_matrix=passed');
  console.log('incoming_clean_download=passed');
  console.log('incoming_eicar_blocked=passed');
  console.log('outgoing_send_clean_admitted=passed');
  console.log('outgoing_send_eicar_blocked=passed');
  console.log('outgoing_draft_clean_admitted=passed');
  console.log('outgoing_draft_eicar_blocked=passed');
  console.log('real_gmail_provider_execution=not_proven');
  console.log('production_runtime_acceptance=unaccepted');
  console.log(`evidence=${path.resolve(args.output)}`);
}

async function readProtectedSecret(filePath) {
  const resolved = path.resolve(filePath);
  const info = await lstat(resolved);
  if (info.isSymbolicLink() || !info.isFile()) {
    throw new Error('Wardveil caller secret must be a regular non-symlink file');
  }
  const mode = info.mode & 0o777;
  if (mode !== 0o400 && mode !== 0o600) {
    throw new Error('Wardveil caller secret mode must be 0400 or 0600');
  }
  if (info.uid !== 0) {
    throw new Error('Wardveil caller secret must be owned by root in the target environment');
  }
  if (info.size < 32 || info.size > MAX_SECRET_BYTES) {
    throw new Error('Wardveil caller secret size is outside the accepted bound');
  }

  const text = await readFile(resolved, 'utf8');
  if (text !== text.trim() || /[\r\n\0]/.test(text)) {
    throw new Error('Wardveil caller secret must be a single exact line with no surrounding whitespace');
  }
  if (Buffer.byteLength(text, 'utf8') < 32) {
    throw new Error('Wardveil caller secret must contain at least 32 bytes');
  }
  return Buffer.from(text, 'utf8');
}

async function writeEvidenceExclusive(filePath, evidence) {
  const resolved = path.resolve(filePath);
  await mkdir(path.dirname(resolved), { recursive: true, mode: 0o755 });
  const handle = await open(resolved, 'wx', 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }
    if (!token.startsWith('--')) throw new TypeError(`unexpected argument: ${token}`);
    const key = fromKebab(token.slice(2));
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new TypeError(`${token} requires a value`);
    args[key] = value;
    index += 1;
  }
  return args;
}

function fromKebab(value) {
  return value.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}

function toKebab(value) {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function printUsage() {
  console.log(`Usage:\n  node scripts/run-mail-wardveil-runtime-acceptance.mjs \\\n    --secret-file /etc/goreecloud/mail/wardveil-scan.secret \\\n    --mail-revision <40-hex-revision> \\\n    --wardveil-revision <40-hex-revision> \\\n    --output /opt/goreecloud/mail/wardveil-acceptance/evidence/<mail-revision>.json \\\n    [--endpoint ${DEFAULT_ENDPOINT}] \\\n    [--caller-id ${DEFAULT_CALLER_ID}] \\\n    [--key-id ${DEFAULT_KEY_ID}]`);
}

main().catch((error) => {
  console.error(`GoreeCloud Mail Wardveil runtime acceptance failed: ${error?.message ?? error}`);
  process.exitCode = 1;
});
