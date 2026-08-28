const PRESENTATION_COPY = Object.freeze({
  'scan-clear': Object.freeze({
    headline: 'Scan clear',
    detail: 'Wardveil found no known threat in the current scan evidence.',
  }),
  'held-for-review': Object.freeze({
    headline: 'Held for review',
    detail: 'Wardveil flagged this attachment for additional review.',
  }),
  'blocked-by-security': Object.freeze({
    headline: 'Blocked by security',
    detail: 'Wardveil identified evidence that requires this attachment to remain blocked.',
  }),
  'verification-unavailable': Object.freeze({
    headline: 'Verification unavailable',
    detail: 'Current authoritative scan evidence is not available for this attachment.',
  }),
});

/**
 * Maps an already-authoritative GoreeCloud Mail attachment-security decision into a
 * conservative browser presentation state. This function does not scan content, reinterpret
 * Wardveil findings, or upgrade absent evidence into an allowed state.
 */
export function presentAttachmentSecurity(decision) {
  if (!decision || typeof decision !== 'object') {
    return buildPresentation('verification-unavailable', [], []);
  }

  const evidenceRefs = Array.isArray(decision.evidence_refs)
    ? decision.evidence_refs.filter((value) => typeof value === 'string' && value.trim())
    : [];
  const reasonCodes = Array.isArray(decision.reason_codes)
    ? decision.reason_codes.filter((value) => typeof value === 'string' && value.trim())
    : [];

  const cleanIsAuthoritative =
    decision.disposition === 'allow'
    && decision.can_open === true
    && decision.can_download === true
    && decision.quarantine_required === false
    && reasonCodes.includes('wardveil_scan_clean_current')
    && evidenceRefs.length > 0;

  if (cleanIsAuthoritative) {
    return buildPresentation('scan-clear', evidenceRefs, reasonCodes, true, true);
  }
  if (decision.disposition === 'hold_review') {
    return buildPresentation('held-for-review', evidenceRefs, reasonCodes);
  }
  if (decision.disposition === 'block_quarantine' || decision.quarantine_required === true) {
    return buildPresentation('blocked-by-security', evidenceRefs, reasonCodes);
  }
  return buildPresentation('verification-unavailable', evidenceRefs, reasonCodes);
}

function buildPresentation(state, evidenceRefs, reasonCodes, canOpen = false, canDownload = false) {
  const copy = PRESENTATION_COPY[state];
  return Object.freeze({
    state,
    headline: copy.headline,
    detail: copy.detail,
    canOpen,
    canDownload,
    showEvidence: evidenceRefs.length > 0,
    evidenceRefs: Object.freeze([...evidenceRefs]),
    reasonCodes: Object.freeze([...reasonCodes]),
  });
}
