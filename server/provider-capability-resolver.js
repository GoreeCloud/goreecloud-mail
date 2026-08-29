import { normalizeCapabilities } from '../web/mail-provider.js';
import { createGmailCapabilityResolver } from './gmail-capability-resolver.js';

/**
 * Trusted provider-capability dispatcher.
 *
 * Provider brand is used only to choose the adapter-specific resolver after the
 * provider account has already passed the session-derived ownership boundary.
 * Unknown or not-yet-implemented providers fail closed to an all-false set.
 */
export function createProviderCapabilityResolver({ credentialVault }) {
  const gmailResolver = createGmailCapabilityResolver({ credentialVault });

  return async ({ account, userId }) => {
    if (!account || !userId) throw new TypeError('account and userId are required');

    switch (account.provider) {
      case 'gmail':
        return gmailResolver({ account, userId });
      default:
        return normalizeCapabilities();
    }
  };
}
