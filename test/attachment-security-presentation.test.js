import test from 'node:test';
import assert from 'node:assert/strict';

import { presentAttachmentSecurity } from '../web/security/attachment-security-presentation.js';

test('current clean Wardveil evidence enables open and download without absolute-safety copy', () => {
  const result = presentAttachmentSecurity({
    disposition: 'allow',
    can_open: true,
    can_download: true,
    quarantine_required: false,
    evidence_refs: ['wardveil:evidence:attachment-1'],
    reason_codes: ['wardveil_scan_clean_current'],
  });

  assert.equal(result.state, 'scan-clear');
  assert.equal(result.canOpen, true);
  assert.equal(result.canDownload, true);
  assert.equal(result.showEvidence, true);
  assert.match(result.detail, /no known threat/i);
  assert.doesNotMatch(result.detail, /safe|harmless|guaranteed/i);
});

test('allow disposition still fails closed without authoritative evidence', () => {
  const result = presentAttachmentSecurity({
    disposition: 'allow',
    can_open: true,
    can_download: true,
    quarantine_required: false,
    evidence_refs: [],
    reason_codes: ['wardveil_scan_clean_current'],
  });

  assert.equal(result.state, 'verification-unavailable');
  assert.equal(result.canOpen, false);
  assert.equal(result.canDownload, false);
});

test('review and quarantine decisions never expose open or download actions', () => {
  const review = presentAttachmentSecurity({
    disposition: 'hold_review',
    can_open: false,
    can_download: false,
    quarantine_required: false,
    evidence_refs: ['wardveil:evidence:review'],
    reason_codes: ['wardveil_scan_suspicious_current'],
  });
  const blocked = presentAttachmentSecurity({
    disposition: 'block_quarantine',
    can_open: false,
    can_download: false,
    quarantine_required: true,
    evidence_refs: ['wardveil:evidence:block'],
    reason_codes: ['wardveil_scan_malicious_current'],
  });

  assert.equal(review.state, 'held-for-review');
  assert.equal(review.canOpen, false);
  assert.equal(review.canDownload, false);
  assert.equal(blocked.state, 'blocked-by-security');
  assert.equal(blocked.canOpen, false);
  assert.equal(blocked.canDownload, false);
});

test('missing, malformed, or incomplete decisions remain verification unavailable', () => {
  for (const decision of [null, undefined, {}, { disposition: 'allow' }]) {
    const result = presentAttachmentSecurity(decision);
    assert.equal(result.state, 'verification-unavailable');
    assert.equal(result.canOpen, false);
    assert.equal(result.canDownload, false);
  }
});
