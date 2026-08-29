import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAIL_PLATFORM_CAPABILITY,
  MAIL_PLATFORM_MODE,
  MailPlatformCapabilityUnavailableError,
  UnsupportedMailPlatformModeError,
  listMailPlatformCapabilities,
  mailPlatformSupports,
  normalizeMailPlatformAccount,
  requireMailPlatformCapability,
} from '../server/mail-platform-capabilities.js';

test('hosted Mail mode exposes first-party service capabilities', () => {
  const capabilities = listMailPlatformCapabilities(MAIL_PLATFORM_MODE.GOREECLOUD_HOSTED);

  assert.equal(capabilities.includes(MAIL_PLATFORM_CAPABILITY.MAILBOX_HOSTING), true);
  assert.equal(capabilities.includes(MAIL_PLATFORM_CAPABILITY.INBOUND_MAIL_TRANSPORT), true);
  assert.equal(capabilities.includes(MAIL_PLATFORM_CAPABILITY.OUTBOUND_MAIL_TRANSPORT), true);
  assert.equal(capabilities.includes(MAIL_PLATFORM_CAPABILITY.CUSTOM_DOMAINS), true);
});

test('external-provider mode retains interoperable client capabilities without inventing provider authority', () => {
  assert.equal(
    mailPlatformSupports(MAIL_PLATFORM_MODE.EXTERNAL_PROVIDER, MAIL_PLATFORM_CAPABILITY.MAILBOX_ACCESS),
    true,
  );
  assert.equal(
    mailPlatformSupports(MAIL_PLATFORM_MODE.EXTERNAL_PROVIDER, MAIL_PLATFORM_CAPABILITY.MAILBOX_HOSTING),
    false,
  );
  assert.throws(
    () =>
      requireMailPlatformCapability({
        mode: MAIL_PLATFORM_MODE.EXTERNAL_PROVIDER,
        capability: MAIL_PLATFORM_CAPABILITY.MAILBOX_HOSTING,
      }),
    MailPlatformCapabilityUnavailableError,
  );
});

test('unknown platform modes fail closed', () => {
  assert.throws(() => listMailPlatformCapabilities('automatic'), UnsupportedMailPlatformModeError);
});

test('platform account routing cannot mix hosted and external-provider identifiers', () => {
  assert.deepEqual(
    normalizeMailPlatformAccount({
      mode: MAIL_PLATFORM_MODE.EXTERNAL_PROVIDER,
      providerAccountId: 'provider-account-1',
    }),
    {
      mode: MAIL_PLATFORM_MODE.EXTERNAL_PROVIDER,
      providerAccountId: 'provider-account-1',
      hostedMailboxId: null,
    },
  );

  assert.deepEqual(
    normalizeMailPlatformAccount({
      mode: MAIL_PLATFORM_MODE.GOREECLOUD_HOSTED,
      hostedMailboxId: 'mailbox-1',
    }),
    {
      mode: MAIL_PLATFORM_MODE.GOREECLOUD_HOSTED,
      providerAccountId: null,
      hostedMailboxId: 'mailbox-1',
    },
  );

  assert.throws(
    () =>
      normalizeMailPlatformAccount({
        mode: MAIL_PLATFORM_MODE.GOREECLOUD_HOSTED,
        providerAccountId: 'provider-account-1',
        hostedMailboxId: 'mailbox-1',
      }),
    /providerAccountId is not valid/i,
  );
});
