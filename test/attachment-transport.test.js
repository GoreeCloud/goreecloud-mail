import assert from 'node:assert/strict';
import test from 'node:test';

import { requestAttachmentTransport } from '../web/security/attachment-transport.js';

const cleanDecision = {
  disposition: 'allow',
  can_open: true,
  can_download: true,
  quarantine_required: false,
  evidence_refs: ['wardveil:test:clean'],
  reason_codes: ['wardveil_scan_clean_current'],
};

function attachment(decision = cleanDecision) {
  return { id: 'attachment-1', filename: 'file.pdf', securityDecision: decision };
}

test('authoritative clean evidence permits exactly one provider transport call', async () => {
  const calls = [];
  const provider = {
    async retrieveAttachment(messageId, attachmentId, action) {
      calls.push({ messageId, attachmentId, action });
      return { source: 'test-local', executable: false };
    },
  };

  const result = await requestAttachmentTransport(provider, 'message-1', attachment(), 'download');
  assert.equal(result.status, 'ready');
  assert.deepEqual(calls, [{ messageId: 'message-1', attachmentId: 'attachment-1', action: 'download' }]);
});

test('held, blocked, and missing evidence never reaches provider transport', async () => {
  let calls = 0;
  const provider = {
    async retrieveAttachment() {
      calls += 1;
      return { source: 'unexpected' };
    },
  };
  const decisions = [
    {
      disposition: 'hold_review',
      can_open: false,
      can_download: false,
      quarantine_required: false,
      evidence_refs: ['wardveil:test:review'],
      reason_codes: ['wardveil_scan_suspicious_current'],
    },
    {
      disposition: 'block_quarantine',
      can_open: false,
      can_download: false,
      quarantine_required: true,
      evidence_refs: ['wardveil:test:block'],
      reason_codes: ['wardveil_scan_malicious_current'],
    },
    null,
  ];

  for (const decision of decisions) {
    const result = await requestAttachmentTransport(provider, 'message-1', attachment(decision), 'open');
    assert.equal(result.status, 'blocked');
  }
  assert.equal(calls, 0);
});

test('invalid action or identity fails before provider transport', async () => {
  const provider = { async retrieveAttachment() { throw new Error('must not run'); } };
  await assert.rejects(
    requestAttachmentTransport(provider, 'message-1', attachment(), 'execute'),
    /open or download/,
  );
  await assert.rejects(
    requestAttachmentTransport(provider, '', attachment(), 'open'),
    /requires message and attachment identity/,
  );
});
