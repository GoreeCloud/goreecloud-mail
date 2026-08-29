import {
  normalizeCapabilities,
  requireMailProviderCapability,
} from '../web/mail-provider.js';
import { requireSessionUser } from './session-context.js';

export class ProviderAccountService {
  constructor({ registry, capabilityResolver = async () => ({}) }) {
    if (!registry) throw new TypeError('registry is required');
    if (typeof capabilityResolver !== 'function') {
      throw new TypeError('capabilityResolver must be a function');
    }
    this.registry = registry;
    this.capabilityResolver = capabilityResolver;
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

  async capabilities({ session, accountId }) {
    const { userId } = requireSessionUser(session);
    const account = this.registry.getForUser(userId, accountId);
    const resolved = await this.capabilityResolver({
      userId,
      account: structuredClone(account),
    });

    return Object.freeze({
      accountId: account.id,
      provider: account.provider,
      capabilities: normalizeCapabilities(resolved),
    });
  }

  async requireCapabilities({ session, accountId, capabilities }) {
    if (!Array.isArray(capabilities) || capabilities.length === 0) {
      throw new TypeError('capabilities must be a non-empty array');
    }

    const resolved = await this.capabilities({ session, accountId });
    for (const capability of capabilities) {
      requireMailProviderCapability({
        capabilities: resolved.capabilities,
        capability,
        accountId: resolved.accountId,
      });
    }

    return Object.freeze({
      accountId: resolved.accountId,
      provider: resolved.provider,
    });
  }
}
