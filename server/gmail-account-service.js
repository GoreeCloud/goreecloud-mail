import { requireSessionUser } from './session-context.js';
import { ProviderError, PROVIDER_ERROR_CODES } from '../web/providers/provider-error.js';
import { MAIL_PROVIDER_CAPABILITY } from '../web/mail-provider.js';

export class GmailAccountService {
  constructor({ accountService, gmailClientFactory }) {
    if (!accountService) throw new TypeError('accountService is required');
    if (typeof gmailClientFactory !== 'function') throw new TypeError('gmailClientFactory is required');
    this.accountService = accountService;
    this.gmailClientFactory = gmailClientFactory;
  }

  async listLabels({ session, accountId }) {
    const context = await this.#context({
      session,
      accountId,
      requiredCapabilities: [MAIL_PROVIDER_CAPABILITY.LABELS],
    });
    return this.gmailClientFactory(context).listLabels(context);
  }

  async listMessages({ session, accountId, options = {} }) {
    const context = await this.#context({
      session,
      accountId,
      requiredCapabilities: [MAIL_PROVIDER_CAPABILITY.MAILBOX_ACCESS],
    });
    return this.gmailClientFactory(context).listMessages(context, options);
  }

  async getMessage({ session, accountId, messageId }) {
    const context = await this.#context({
      session,
      accountId,
      requiredCapabilities: [MAIL_PROVIDER_CAPABILITY.MESSAGE_READ],
    });
    return this.gmailClientFactory(context).getMessage(context, messageId);
  }

  async getAttachment({ session, accountId, messageId, attachmentId, maxBytes }) {
    const context = await this.#context({
      session,
      accountId,
      requiredCapabilities: [
        MAIL_PROVIDER_CAPABILITY.MAILBOX_ACCESS,
        MAIL_PROVIDER_CAPABILITY.ATTACHMENT_RETRIEVAL,
      ],
    });
    return this.gmailClientFactory(context).getAttachment(context, {
      messageId,
      attachmentId,
      maxBytes,
    });
  }

  async #context({ session, accountId, requiredCapabilities }) {
    const { userId } = requireSessionUser(session);
    const account = this.accountService.get({ session, accountId });
    if (account.provider !== 'gmail') {
      throw new ProviderError('This provider account does not support Gmail operations.', {
        code: PROVIDER_ERROR_CODES.UNSUPPORTED,
        status: 400,
      });
    }

    await this.accountService.requireCapabilities({
      session,
      accountId,
      capabilities: requiredCapabilities,
    });

    return Object.freeze({ userId, accountId: account.id, provider: account.provider });
  }
}
