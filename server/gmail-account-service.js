import { requireSessionUser } from './session-context.js';
import { ProviderError, PROVIDER_ERROR_CODES } from '../web/providers/provider-error.js';
import { MAIL_PROVIDER_CAPABILITY } from '../web/mail-provider.js';
import { buildGmailRawMessage } from './gmail-message-builder.js';

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

  async send({ session, accountId, message }) {
    const context = await this.#writeContext({
      session,
      accountId,
      message,
      capability: MAIL_PROVIDER_CAPABILITY.SEND,
    });
    const built = buildGmailRawMessage(message);
    return this.gmailClientFactory(context).sendMessage(context, { raw: built.raw });
  }

  async createDraft({ session, accountId, message }) {
    const context = await this.#writeContext({
      session,
      accountId,
      message,
      capability: MAIL_PROVIDER_CAPABILITY.DRAFTS,
    });
    const built = buildGmailRawMessage(message);
    return this.gmailClientFactory(context).createDraft(context, { raw: built.raw });
  }

  async updateDraft({ session, accountId, draftId, message }) {
    if (!draftId) throw new TypeError('draftId is required');
    const context = await this.#writeContext({
      session,
      accountId,
      message,
      capability: MAIL_PROVIDER_CAPABILITY.DRAFTS,
    });
    const built = buildGmailRawMessage(message);
    return this.gmailClientFactory(context).updateDraft(context, { draftId, raw: built.raw });
  }

  async #writeContext({ session, accountId, message, capability }) {
    const requiredCapabilities = [capability];
    if (message?.from) requiredCapabilities.push(MAIL_PROVIDER_CAPABILITY.SENDER_IDENTITIES);
    return this.#context({ session, accountId, requiredCapabilities });
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
