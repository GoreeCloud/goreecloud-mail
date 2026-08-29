import { normalizeCapabilities } from '../web/mail-provider.js';

export const GMAIL_OAUTH_SCOPE = Object.freeze({
  FULL_MAIL: 'https://mail.google.com/',
  COMPOSE: 'https://www.googleapis.com/auth/gmail.compose',
  LABELS: 'https://www.googleapis.com/auth/gmail.labels',
  METADATA: 'https://www.googleapis.com/auth/gmail.metadata',
  MODIFY: 'https://www.googleapis.com/auth/gmail.modify',
  READONLY: 'https://www.googleapis.com/auth/gmail.readonly',
  SEND: 'https://www.googleapis.com/auth/gmail.send',
  SETTINGS_BASIC: 'https://www.googleapis.com/auth/gmail.settings.basic',
  SETTINGS_SHARING: 'https://www.googleapis.com/auth/gmail.settings.sharing',
});

/**
 * Parse the scope representation returned by Google's OAuth token endpoint or
 * stored by the GoreeCloud credential-vault boundary.
 */
export function parseGmailGrantedScopes(value) {
  const values = value instanceof Set
    ? [...value]
    : Array.isArray(value)
      ? value
      : typeof value === 'string'
        ? value.split(/\s+/)
        : [];

  const scopes = new Set();
  for (const item of values) {
    if (typeof item !== 'string') continue;
    for (const token of item.trim().split(/\s+/)) {
      if (token) scopes.add(token);
    }
  }
  return scopes;
}

/**
 * Resolve the effective Gmail capabilities currently implemented by GoreeCloud
 * Mail and authorized by the granted account scopes.
 *
 * A granted OAuth scope is necessary but not sufficient for an operation. This
 * resolver deliberately keeps capabilities such as send, drafts, mutation,
 * incremental sync, rules, and sender identities false until the corresponding
 * trusted GoreeCloud provider transport exists and is separately wired.
 */
export function resolveGmailCapabilitiesFromScopes(grantedScopes) {
  const scopes = parseGmailGrantedScopes(grantedScopes);
  const fullMail = scopes.has(GMAIL_OAUTH_SCOPE.FULL_MAIL);
  const canReadMessages = fullMail
    || scopes.has(GMAIL_OAUTH_SCOPE.MODIFY)
    || scopes.has(GMAIL_OAUTH_SCOPE.READONLY);
  const canReadLabels = canReadMessages || scopes.has(GMAIL_OAUTH_SCOPE.LABELS);

  return normalizeCapabilities({
    mailboxAccess: canReadMessages || canReadLabels,
    messageRead: canReadMessages,
    attachmentRetrieval: canReadMessages,
    labels: canReadLabels,
  });
}

/**
 * Build a trusted Gmail account capability resolver backed by the credential
 * vault. Missing authorization fails closed to the normalized all-false set.
 */
export function createGmailCapabilityResolver({ credentialVault }) {
  if (!credentialVault || typeof credentialVault.get !== 'function') {
    throw new TypeError('credentialVault with get() is required');
  }

  return async ({ account, userId }) => {
    if (!account || !userId) throw new TypeError('account and userId are required');
    if (account.provider !== 'gmail') return normalizeCapabilities();

    try {
      const secret = credentialVault.get({ userId, accountId: account.id });
      return resolveGmailCapabilitiesFromScopes(secret?.scope);
    } catch (error) {
      if (error?.code === 'credential-not-found') return normalizeCapabilities();
      throw error;
    }
  };
}
