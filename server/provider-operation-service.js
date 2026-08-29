import { ProviderError, PROVIDER_ERROR_CODES } from '../web/providers/provider-error.js';

export class ProviderOperationService {
  constructor({ accountService, providerServices = {} } = {}) {
    if (!accountService) throw new TypeError('accountService is required');
    this.accountService = accountService;
    this.providerServices = new Map(Object.entries(providerServices));
  }

  async send({ session, accountId, message }) {
    const service = this.#service({ session, accountId, operation: 'send' });
    return service.send({ session, accountId, message });
  }

  async createDraft({ session, accountId, message }) {
    const service = this.#service({ session, accountId, operation: 'createDraft' });
    return service.createDraft({ session, accountId, message });
  }

  async updateDraft({ session, accountId, draftId, message }) {
    const service = this.#service({ session, accountId, operation: 'updateDraft' });
    return service.updateDraft({ session, accountId, draftId, message });
  }

  #service({ session, accountId, operation }) {
    const account = this.accountService.get({ session, accountId });
    const service = this.providerServices.get(account.provider);
    if (!service || typeof service[operation] !== 'function') {
      throw new ProviderError('This provider account does not support the requested Mail operation.', {
        code: PROVIDER_ERROR_CODES.UNSUPPORTED,
        status: 400,
      });
    }
    return service;
  }
}
