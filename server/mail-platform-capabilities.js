export const MAIL_PLATFORM_MODE = Object.freeze({
  GOREECLOUD_HOSTED: 'goreecloud-hosted',
  EXTERNAL_PROVIDER: 'external-provider',
});

export const MAIL_PLATFORM_CAPABILITY = Object.freeze({
  MAILBOX_ACCESS: 'mailbox-access',
  MESSAGE_SEND: 'message-send',
  DRAFTS: 'drafts',
  SEARCH: 'search',
  RULES: 'rules',
  ATTACHMENTS: 'attachments',
  CUSTOM_DOMAINS: 'custom-domains',
  MAILBOX_HOSTING: 'mailbox-hosting',
  INBOUND_MAIL_TRANSPORT: 'inbound-mail-transport',
  OUTBOUND_MAIL_TRANSPORT: 'outbound-mail-transport',
  ALIASES: 'aliases',
  RETENTION_POLICY: 'retention-policy',
  ORGANIZATION_ADMINISTRATION: 'organization-administration',
});

const COMMON_CAPABILITIES = Object.freeze([
  MAIL_PLATFORM_CAPABILITY.MAILBOX_ACCESS,
  MAIL_PLATFORM_CAPABILITY.MESSAGE_SEND,
  MAIL_PLATFORM_CAPABILITY.DRAFTS,
  MAIL_PLATFORM_CAPABILITY.SEARCH,
  MAIL_PLATFORM_CAPABILITY.RULES,
  MAIL_PLATFORM_CAPABILITY.ATTACHMENTS,
  MAIL_PLATFORM_CAPABILITY.ALIASES,
]);

const HOSTED_CAPABILITIES = Object.freeze([
  ...COMMON_CAPABILITIES,
  MAIL_PLATFORM_CAPABILITY.CUSTOM_DOMAINS,
  MAIL_PLATFORM_CAPABILITY.MAILBOX_HOSTING,
  MAIL_PLATFORM_CAPABILITY.INBOUND_MAIL_TRANSPORT,
  MAIL_PLATFORM_CAPABILITY.OUTBOUND_MAIL_TRANSPORT,
  MAIL_PLATFORM_CAPABILITY.RETENTION_POLICY,
  MAIL_PLATFORM_CAPABILITY.ORGANIZATION_ADMINISTRATION,
]);

const EXTERNAL_PROVIDER_CAPABILITIES = Object.freeze([...COMMON_CAPABILITIES]);

const CAPABILITIES_BY_MODE = Object.freeze({
  [MAIL_PLATFORM_MODE.GOREECLOUD_HOSTED]: HOSTED_CAPABILITIES,
  [MAIL_PLATFORM_MODE.EXTERNAL_PROVIDER]: EXTERNAL_PROVIDER_CAPABILITIES,
});

export class UnsupportedMailPlatformModeError extends Error {
  constructor(mode) {
    super(`Unsupported GoreeCloud Mail platform mode: ${String(mode)}`);
    this.name = 'UnsupportedMailPlatformModeError';
    this.code = 'unsupported-mail-platform-mode';
  }
}

export class MailPlatformCapabilityUnavailableError extends Error {
  constructor({ mode, capability }) {
    super(`Mail platform capability ${String(capability)} is not available in ${String(mode)} mode.`);
    this.name = 'MailPlatformCapabilityUnavailableError';
    this.code = 'mail-platform-capability-unavailable';
    this.mode = mode;
    this.capability = capability;
  }
}

export function listMailPlatformCapabilities(mode) {
  const capabilities = CAPABILITIES_BY_MODE[mode];
  if (!capabilities) throw new UnsupportedMailPlatformModeError(mode);
  return Object.freeze([...capabilities]);
}

export function mailPlatformSupports(mode, capability) {
  return listMailPlatformCapabilities(mode).includes(capability);
}

export function requireMailPlatformCapability({ mode, capability }) {
  if (!mailPlatformSupports(mode, capability)) {
    throw new MailPlatformCapabilityUnavailableError({ mode, capability });
  }
  return true;
}

/**
 * Normalizes the account/service routing boundary without claiming that a
 * GoreeCloud-hosted mail transport is production-ready. Hosted-mode runtime
 * services remain separately gated by deployment and production acceptance.
 */
export function normalizeMailPlatformAccount(input) {
  if (!input || typeof input !== 'object') throw new TypeError('account input is required');

  const { mode, providerAccountId = null, hostedMailboxId = null } = input;
  listMailPlatformCapabilities(mode);

  if (mode === MAIL_PLATFORM_MODE.EXTERNAL_PROVIDER) {
    if (!providerAccountId) throw new TypeError('providerAccountId is required for external-provider mode');
    if (hostedMailboxId) throw new TypeError('hostedMailboxId is not valid for external-provider mode');
  }

  if (mode === MAIL_PLATFORM_MODE.GOREECLOUD_HOSTED) {
    if (!hostedMailboxId) throw new TypeError('hostedMailboxId is required for goreecloud-hosted mode');
    if (providerAccountId) throw new TypeError('providerAccountId is not valid for goreecloud-hosted mode');
  }

  return Object.freeze({
    mode,
    providerAccountId,
    hostedMailboxId,
  });
}
