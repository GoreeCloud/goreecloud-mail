import { readFile, readdir, stat } from 'node:fs/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  ATTACHMENT_SECURITY_CODES,
  AttachmentDeliveryService,
} from './attachment-delivery-service.js';
import { wardveilScanProvenancePath } from './attachment-scan-provenance-store.js';
import { GmailAccountService } from './gmail-account-service.js';
import { decodeGmailRawMessage } from './gmail-message-builder.js';
import { GmailOutgoingAttachmentSecurityGate } from './gmail-outgoing-attachment-security.js';
import {
  outgoingWardveilScanProvenancePath,
  readOutgoingWardveilScanProvenance,
} from './outgoing-attachment-scan-provenance-store.js';

const REVISION_RE = /^[0-9a-f]{40}$/;
const OUTGOING_PROVENANCE_RE = /^\.wardveil-outgoing-([0-9a-f]{64})\.json$/;
const SESSION = Object.freeze({ userId: 'wardveil-runtime-acceptance' });
const ACCOUNT_ID = 'runtime-account';
const CLEAN_BYTES = Buffer.from('GoreeCloud Mail Wardveil runtime clean control\n', 'utf8');
const EICAR_BYTES = Buffer.from(
  'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*',
  'ascii',
);

/**
 * Exercise GoreeCloud Mail's real incoming delivery and outgoing Gmail service
 * enforcement paths against the supplied Wardveil Scan client.
 *
 * Provider I/O is deliberately controlled and non-networked. This establishes
 * application-consumer behavior against the deployed Wardveil service without
 * claiming that a real Gmail mailbox/provider write has been production accepted.
 */
export async function runMailWardveilRuntimeAcceptance({
  wardveilScanClient,
  mailRevision,
  wardveilRevision,
  wardveilEndpoint,
  now = () => new Date(),
} = {}) {
  requireCondition(
    wardveilScanClient &&
      typeof wardveilScanClient.scanAttachment === 'function' &&
      typeof wardveilScanClient.scan === 'function',
    'wardveilScanClient must expose scanAttachment and scan',
  );
  requireRevision(mailRevision, 'mailRevision');
  requireRevision(wardveilRevision, 'wardveilRevision');
  if (typeof wardveilEndpoint !== 'string' || !wardveilEndpoint) {
    throw new TypeError('wardveilEndpoint is required');
  }
  if (typeof now !== 'function') throw new TypeError('now must be a function');

  const workRoot = await mkdtemp(path.join(tmpdir(), 'goreecloud-mail-wardveil-runtime-'));
  const incomingRoot = path.join(workRoot, 'incoming');
  const outgoingRoot = path.join(workRoot, 'outgoing');
  const providerState = {
    clientFactoryCalls: 0,
    attachmentReads: 0,
    sendWrites: [],
    draftWrites: [],
  };

  try {
    const accountService = controlledAccountService();
    const outgoingGate = new GmailOutgoingAttachmentSecurityGate({
      wardveilScanClient,
      provenanceRootDir: outgoingRoot,
    });
    const gmailAccountService = new GmailAccountService({
      accountService,
      outgoingAttachmentSecurityGate: outgoingGate,
      gmailClientFactory: () => {
        providerState.clientFactoryCalls += 1;
        return controlledGmailClient(providerState);
      },
    });
    const delivery = new AttachmentDeliveryService({
      gmailAccountService,
      wardveilScanClient,
      rootDir: incomingRoot,
    });

    const incomingClean = await exerciseIncomingClean({ delivery, incomingRoot });
    const incomingEicar = await exerciseIncomingEicar({ delivery, incomingRoot });
    const outgoingClean = await exerciseOutgoingClean({
      gmailAccountService,
      outgoingRoot,
      providerState,
    });
    const outgoingEicar = await exerciseOutgoingEicar({
      gmailAccountService,
      outgoingRoot,
      providerState,
    });

    return Object.freeze({
      component: 'GoreeCloud Mail Wardveil Scan runtime application-consumer acceptance',
      mail_revision: mailRevision,
      wardveil_revision: wardveilRevision,
      wardveil_endpoint: wardveilEndpoint,
      runtime_application_consumer_matrix: 'passed',
      live_wardveil_cases: Object.freeze([
        'incoming_clean_download',
        'incoming_eicar_blocked',
        'outgoing_send_clean_admitted',
        'outgoing_send_eicar_blocked',
        'outgoing_draft_clean_admitted',
        'outgoing_draft_eicar_blocked',
      ]),
      incoming_clean_download: incomingClean,
      incoming_eicar_blocked: incomingEicar,
      outgoing_clean_admission: outgoingClean,
      outgoing_eicar_blocked: outgoingEicar,
      controlled_provider_boundary: 'passed',
      real_gmail_provider_execution: 'not_proven',
      production_service_identity: 'not_proven',
      revoked_credential: 'not_proven',
      stale_signatures: 'not_proven',
      capacity_exhaustion: 'not_proven',
      authorized_quarantine_execution: 'not_proven',
      wardveil_audit_security_center_provenance: 'not_proven',
      production_runtime_acceptance: 'unaccepted',
      protection_claim_authority: false,
      raw_attachment_content_in_evidence: false,
      provider_credentials_in_evidence: false,
      wardveil_caller_secret_in_evidence: false,
      observed_at: now().toISOString(),
    });
  } finally {
    await rm(workRoot, { recursive: true, force: true });
  }
}

async function exerciseIncomingClean({ delivery, incomingRoot }) {
  const record = await delivery.retrieveGmailAttachment({
    session: SESSION,
    accountId: ACCOUNT_ID,
    messageId: 'runtime-message-clean',
    attachmentId: 'runtime-clean',
    metadata: { filename: 'runtime-clean.txt', mimeType: 'text/plain' },
    maxBytes: 1024 * 1024,
  });
  requireCondition(record?.objectId, 'incoming clean delivery did not create an object');

  const authorized = delivery.authorizeDownload({
    session: SESSION,
    objectId: record.objectId,
  });
  const storedBytes = await readFile(authorized.path);
  requireCondition(
    storedBytes.equals(CLEAN_BYTES),
    'incoming clean authorized bytes differ from controlled provider bytes',
  );

  const provenancePath = wardveilScanProvenancePath({
    rootDir: incomingRoot,
    objectId: record.objectId,
  });
  const provenanceMode = await fileMode(provenancePath);
  requireCondition(provenanceMode === '0600', 'incoming Wardveil provenance is not mode 0600');

  await delivery.remove({ session: SESSION, objectId: record.objectId });
  requireCondition((await readdir(incomingRoot)).length === 0, 'incoming clean cleanup left artifacts');

  return Object.freeze({
    status: 'passed',
    exact_provider_bytes_downloaded: true,
    downloadable_object_created_only_after_clean_scan: true,
    durable_clean_provenance: true,
    provenance_file_mode: provenanceMode,
    cleanup_coordinated: true,
  });
}

async function exerciseIncomingEicar({ delivery, incomingRoot }) {
  let observed = null;
  try {
    await delivery.retrieveGmailAttachment({
      session: SESSION,
      accountId: ACCOUNT_ID,
      messageId: 'runtime-message-eicar',
      attachmentId: 'runtime-eicar',
      metadata: { filename: 'runtime-eicar.txt', mimeType: 'text/plain' },
      maxBytes: 1024 * 1024,
    });
  } catch (error) {
    observed = error;
  }

  requireCondition(observed, 'incoming EICAR control was unexpectedly allowed');
  requireCondition(
    observed.code === ATTACHMENT_SECURITY_CODES.SCAN_BLOCKED,
    `incoming EICAR control returned unexpected code ${observed.code ?? 'none'}`,
  );
  requireCondition(
    (await readdir(incomingRoot)).length === 0,
    'incoming EICAR control created downloadable cache/provenance artifacts',
  );

  return Object.freeze({
    status: 'passed',
    security_code: ATTACHMENT_SECURITY_CODES.SCAN_BLOCKED,
    blocked_before_downloadable_cache: true,
    downloadable_object_created: false,
  });
}

async function exerciseOutgoingClean({ gmailAccountService, outgoingRoot, providerState }) {
  const sendResult = await gmailAccountService.send({
    session: SESSION,
    accountId: ACCOUNT_ID,
    message: outgoingMessage(CLEAN_BYTES, 'runtime-send-clean'),
  });
  requireCondition(sendResult?.id === 'controlled-send-1', 'controlled clean send was not admitted');

  const draftResult = await gmailAccountService.createDraft({
    session: SESSION,
    accountId: ACCOUNT_ID,
    message: outgoingMessage(CLEAN_BYTES, 'runtime-draft-clean'),
  });
  requireCondition(draftResult?.id === 'controlled-draft-1', 'controlled clean draft was not admitted');
  requireCondition(providerState.sendWrites.length === 1, 'clean send did not reach controlled provider write');
  requireCondition(providerState.draftWrites.length === 1, 'clean draft did not reach controlled provider write');

  const expectedBase64 = CLEAN_BYTES.toString('base64');
  for (const raw of [providerState.sendWrites[0], providerState.draftWrites[0]]) {
    const decoded = decodeGmailRawMessage(raw);
    requireCondition(
      decoded.includes(expectedBase64),
      'controlled provider MIME does not contain the exact Wardveil-authorized bytes',
    );
  }

  const files = (await readdir(outgoingRoot)).filter((name) => OUTGOING_PROVENANCE_RE.test(name));
  requireCondition(files.length === 2, 'clean send/draft did not persist two outgoing provenance records');

  const actions = new Set();
  const modes = new Set();
  for (const name of files) {
    const operationId = OUTGOING_PROVENANCE_RE.exec(name)?.[1];
    requireCondition(operationId, 'outgoing provenance filename is invalid');
    const provenance = readOutgoingWardveilScanProvenance({
      rootDir: outgoingRoot,
      operationId,
    });
    requireCondition(provenance.scans.length === 1, 'outgoing provenance scan count is invalid');
    actions.add(provenance.action);
    modes.add(await fileMode(outgoingWardveilScanProvenancePath({ rootDir: outgoingRoot, operationId })));
  }
  requireCondition(actions.has('send') && actions.has('draft'), 'outgoing provenance actions are incomplete');
  requireCondition(modes.size === 1 && modes.has('0600'), 'outgoing provenance is not mode 0600');

  return Object.freeze({
    status: 'passed',
    send_provider_write_admitted: true,
    draft_provider_write_admitted: true,
    exact_authorized_bytes_in_provider_mime: true,
    durable_clean_provenance_records: 2,
    provenance_file_mode: '0600',
  });
}

async function exerciseOutgoingEicar({ gmailAccountService, outgoingRoot, providerState }) {
  const provenanceCountBefore = (await readdir(outgoingRoot)).filter((name) => OUTGOING_PROVENANCE_RE.test(name)).length;

  const sendFactoryBefore = providerState.clientFactoryCalls;
  const sendWritesBefore = providerState.sendWrites.length;
  const sendError = await captureError(() => gmailAccountService.send({
    session: SESSION,
    accountId: ACCOUNT_ID,
    message: outgoingMessage(EICAR_BYTES, 'runtime-send-eicar'),
  }));
  requireCondition(sendError, 'outgoing EICAR send was unexpectedly allowed');
  requireCondition(sendError.code === ATTACHMENT_SECURITY_CODES.SCAN_BLOCKED, 'outgoing EICAR send did not fail as scan-blocked');
  requireCondition(providerState.clientFactoryCalls === sendFactoryBefore, 'outgoing EICAR send created a provider client');
  requireCondition(providerState.sendWrites.length === sendWritesBefore, 'outgoing EICAR send reached provider write');

  const draftFactoryBefore = providerState.clientFactoryCalls;
  const draftWritesBefore = providerState.draftWrites.length;
  const draftError = await captureError(() => gmailAccountService.createDraft({
    session: SESSION,
    accountId: ACCOUNT_ID,
    message: outgoingMessage(EICAR_BYTES, 'runtime-draft-eicar'),
  }));
  requireCondition(draftError, 'outgoing EICAR draft was unexpectedly allowed');
  requireCondition(draftError.code === ATTACHMENT_SECURITY_CODES.SCAN_BLOCKED, 'outgoing EICAR draft did not fail as scan-blocked');
  requireCondition(providerState.clientFactoryCalls === draftFactoryBefore, 'outgoing EICAR draft created a provider client');
  requireCondition(providerState.draftWrites.length === draftWritesBefore, 'outgoing EICAR draft reached provider write');

  const provenanceCountAfter = (await readdir(outgoingRoot)).filter((name) => OUTGOING_PROVENANCE_RE.test(name)).length;
  requireCondition(provenanceCountAfter === provenanceCountBefore, 'blocked outgoing EICAR created clean provenance');

  return Object.freeze({
    status: 'passed',
    security_code: ATTACHMENT_SECURITY_CODES.SCAN_BLOCKED,
    send_blocked_before_provider_client: true,
    send_provider_write_performed: false,
    draft_blocked_before_provider_client: true,
    draft_provider_write_performed: false,
    clean_provenance_created_for_blocked_content: false,
  });
}

function controlledAccountService() {
  return {
    get({ session, accountId }) {
      requireCondition(session?.userId === SESSION.userId, 'controlled account service session mismatch');
      requireCondition(String(accountId) === ACCOUNT_ID, 'controlled account service account mismatch');
      return Object.freeze({ id: ACCOUNT_ID, provider: 'gmail' });
    },
    async requireCapabilities({ session, accountId }) {
      requireCondition(session?.userId === SESSION.userId, 'controlled capability session mismatch');
      requireCondition(String(accountId) === ACCOUNT_ID, 'controlled capability account mismatch');
      return true;
    },
  };
}

function controlledGmailClient(providerState) {
  return {
    async getAttachment(_context, { attachmentId }) {
      providerState.attachmentReads += 1;
      const bytes = attachmentId === 'runtime-eicar' ? EICAR_BYTES : CLEAN_BYTES;
      return Object.freeze({ attachmentId, size: bytes.length, bytes: Buffer.from(bytes) });
    },
    async sendMessage(_context, { raw }) {
      providerState.sendWrites.push(String(raw));
      return Object.freeze({ id: `controlled-send-${providerState.sendWrites.length}`, threadId: null, labelIds: ['SENT'] });
    },
    async createDraft(_context, { raw }) {
      providerState.draftWrites.push(String(raw));
      return Object.freeze({
        id: `controlled-draft-${providerState.draftWrites.length}`,
        message: Object.freeze({ id: null, threadId: null, labelIds: [] }),
      });
    },
  };
}

function outgoingMessage(bytes, clientMutationId) {
  return Object.freeze({
    to: 'runtime-acceptance@example.invalid',
    subject: 'Wardveil runtime acceptance control',
    body: 'Controlled GoreeCloud Mail runtime acceptance message.',
    clientMutationId,
    attachments: Object.freeze([
      Object.freeze({
        filename: 'runtime-control.txt',
        contentType: 'text/plain',
        contentBase64: Buffer.from(bytes).toString('base64'),
      }),
    ]),
  });
}

async function captureError(run) {
  try {
    await run();
    return null;
  } catch (error) {
    return error;
  }
}

async function fileMode(filePath) {
  const info = await stat(filePath);
  return (info.mode & 0o777).toString(8).padStart(4, '0');
}

function requireRevision(value, name) {
  if (typeof value !== 'string' || !REVISION_RE.test(value)) {
    throw new TypeError(`${name} must be an exact lowercase 40-character Git revision`);
  }
  return value;
}

function requireCondition(condition, message) {
  if (!condition) throw new Error(`Mail Wardveil runtime acceptance failed: ${message}`);
}

export const MAIL_WARDVEIL_RUNTIME_ACCEPTANCE_CONTROLS = Object.freeze({
  cleanBytesLength: CLEAN_BYTES.length,
  eicarBytesLength: EICAR_BYTES.length,
});
