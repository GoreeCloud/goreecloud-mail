import { createHash } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';

import { runMailWardveilRuntimeAcceptance } from '../server/mail-wardveil-runtime-acceptance.js';

const MAIL_REVISION = '8f20cdbe964f987cd9e1e1a12c5d71e10bfe8708';
const WARDVEIL_REVISION = '053c7fd81db3011cf1d7b7b304d4b33413e97e4b';

function fakeWardveilClient(calls) {
  function scanEnvelope({ resourceId, bytes, action }) {
    const content = Buffer.from(bytes);
    const malicious = content.includes(Buffer.from('EICAR-STANDARD-ANTIVIRUS-TEST-FILE', 'ascii'));
    const digest = createHash('sha256').update(content).digest('hex');
    const observedAt = new Date(Date.now() - 1000).toISOString();
    const validUntil = new Date(Date.now() + 60_000).toISOString();
    const correlationId = `acceptance-${calls.length + 1}`;
    calls.push({ resourceId, bytes: content, action });
    return {
      resource_id: resourceId,
      resource_digest_sha256: digest,
      scan_record: {
        contract_version: '0.1.0',
        record_id: `runtime-${malicious ? 'malicious' : 'clean'}-${calls.length}`,
        record_type: 'scan_finding',
        correlation_id: correlationId,
        producer: { id: 'wardveil-scan', authoritative: true },
        scope: { resource_type: 'mail_attachment', resource_id: resourceId },
        observed_at: observedAt,
        valid_until: validUntil,
        result: malicious ? 'malicious' : 'clean',
        evidence_refs: [`wardveil:runtime:test:${calls.length}`],
      },
    };
  }

  return {
    async scanAttachment({ messageId, attachmentId, bytes, action }) {
      return scanEnvelope({
        resourceId: `mail:${messageId}:attachment:${attachmentId}`,
        bytes,
        action,
      });
    },
    async scan({ resourceId, bytes, action }) {
      return scanEnvelope({ resourceId, bytes, action });
    },
  };
}

test('runtime acceptance harness exercises incoming and outgoing Mail enforcement without claiming real Gmail acceptance', async () => {
  const calls = [];
  const evidence = await runMailWardveilRuntimeAcceptance({
    wardveilScanClient: fakeWardveilClient(calls),
    mailRevision: MAIL_REVISION,
    wardveilRevision: WARDVEIL_REVISION,
    wardveilEndpoint: 'http://127.0.0.1:8791/v1/scan',
    now: () => new Date('2026-08-31T04:00:00.000Z'),
  });

  assert.equal(evidence.runtime_application_consumer_matrix, 'passed');
  assert.equal(evidence.mail_revision, MAIL_REVISION);
  assert.equal(evidence.wardveil_revision, WARDVEIL_REVISION);
  assert.equal(evidence.incoming_clean_download.status, 'passed');
  assert.equal(evidence.incoming_clean_download.provenance_file_mode, '0600');
  assert.equal(evidence.incoming_eicar_blocked.status, 'passed');
  assert.equal(evidence.incoming_eicar_blocked.downloadable_object_created, false);
  assert.equal(evidence.outgoing_clean_admission.send_provider_write_admitted, true);
  assert.equal(evidence.outgoing_clean_admission.draft_provider_write_admitted, true);
  assert.equal(evidence.outgoing_clean_admission.exact_authorized_bytes_in_provider_mime, true);
  assert.equal(evidence.outgoing_clean_admission.durable_clean_provenance_records, 2);
  assert.equal(evidence.outgoing_eicar_blocked.send_blocked_before_provider_client, true);
  assert.equal(evidence.outgoing_eicar_blocked.send_provider_write_performed, false);
  assert.equal(evidence.outgoing_eicar_blocked.draft_blocked_before_provider_client, true);
  assert.equal(evidence.outgoing_eicar_blocked.draft_provider_write_performed, false);
  assert.equal(evidence.controlled_provider_boundary, 'passed');
  assert.equal(evidence.real_gmail_provider_execution, 'not_proven');
  assert.equal(evidence.production_service_identity, 'not_proven');
  assert.equal(evidence.production_runtime_acceptance, 'unaccepted');
  assert.equal(evidence.protection_claim_authority, false);
  assert.equal(evidence.raw_attachment_content_in_evidence, false);
  assert.equal(evidence.provider_credentials_in_evidence, false);
  assert.equal(evidence.wardveil_caller_secret_in_evidence, false);
  assert.equal(evidence.observed_at, '2026-08-31T04:00:00.000Z');

  assert.deepEqual(
    calls.map((call) => call.action),
    ['download', 'download', 'send', 'draft', 'send', 'draft'],
  );
});

test('runtime acceptance harness requires exact source revisions', async () => {
  await assert.rejects(
    runMailWardveilRuntimeAcceptance({
      wardveilScanClient: fakeWardveilClient([]),
      mailRevision: 'main',
      wardveilRevision: WARDVEIL_REVISION,
      wardveilEndpoint: 'http://127.0.0.1:8791/v1/scan',
    }),
    /mailRevision must be an exact lowercase 40-character Git revision/,
  );
});
