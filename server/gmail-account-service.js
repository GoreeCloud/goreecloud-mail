import { requireSessionUser } from './session-context.js';
import { ProviderError, PROVIDER_ERROR_CODES } from '../web/providers/provider-error.js';

export class GmailAccountService {
  constructor({ accountService, gmailClientFactory }) {
    if (!accountService) throw new TypeError('accountService is required');
    if (typeof gmailClientFactory !== 'function') throw new TypeError('gmailClientFactory is required');
    this.accountService = accountService;
    this.gmailClientFactory = gmailClientFactory;
  }

  async listLabels({ session, accountId }) {
    const context = this.#context({ session, accountId });
    return this.gmailClientFactory(context).listLabels(context);
  }

  async listMessages({ session, accountId, options = {} }) {
    const context = this.#context({ session, accountId });
    return this.gmailClientFactory(context).listMessages(context, options);
  }

  async getMessage({ session, accountId, messageId }) {
    const context = this.#context({ session, accountId });
    return this.gmailClientFactory(context).getMessage(context, messageId);
  }

  #context({ session, accountId }) {
    const { userId } = requireSessionUser(session);
    const account = this.accountService.get({ session, accountId });
    if (account.provider !== 'gmail') {
      throw new ProviderError('This provider account does not support Gmail operations.', {
        code: PROVIDER_ERROR_CODES.UNSUPPORTED,
        status: 400,
      });
    }
    return Object.freeze({ userId, accountId: account.id, provider: account.provider });
  }
}
