import { requireSessionUser } from './session-context.js';

export class ProviderAccountService {
  constructor({ registry }) {
    if (!registry) throw new TypeError('registry is required');
    this.registry = registry;
  }

  list({ session }) {
    const { userId } = requireSessionUser(session);
    return this.registry.listForUser(userId);
  }

  get({ session, accountId }) {
    const { userId } = requireSessionUser(session);
    return this.registry.getForUser(userId, accountId);
  }

  create({ session, provider, externalAccountId = null, displayName = null }) {
    const { userId } = requireSessionUser(session);
    return this.registry.create({ userId, provider, externalAccountId, displayName });
  }

  remove({ session, accountId }) {
    const { userId } = requireSessionUser(session);
    this.registry.removeForUser(userId, accountId);
    return { removed: true };
  }
}
