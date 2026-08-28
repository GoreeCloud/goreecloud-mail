export const REQUIRED_MAIL_PROVIDER_METHODS = Object.freeze([
  'authenticate',
  'listMailboxes',
  'listMessages',
  'getMessage',
  'retrieveAttachment',
  'search',
  'send',
  'createDraft',
  'updateDraft',
  'move',
  'archive',
  'remove',
  'flag',
  'sync',
  'capabilities',
]);

export function validateMailProvider(provider) {
  if (!provider || typeof provider !== 'object') {
    throw new TypeError('Mail provider must be an object.');
  }

  const missing = REQUIRED_MAIL_PROVIDER_METHODS.filter(
    (method) => typeof provider[method] !== 'function',
  );

  if (missing.length > 0) {
    throw new Error(`Mail provider is missing required methods: ${missing.join(', ')}`);
  }

  return provider;
}

export function normalizeCapabilities(capabilities = {}) {
  return Object.freeze({
    archive: Boolean(capabilities.archive),
    attachments: Boolean(capabilities.attachments),
    drafts: Boolean(capabilities.drafts),
    flags: Boolean(capabilities.flags),
    folders: Boolean(capabilities.folders),
    labels: Boolean(capabilities.labels),
    search: Boolean(capabilities.search),
    send: Boolean(capabilities.send),
    threads: Boolean(capabilities.threads),
  });
}
