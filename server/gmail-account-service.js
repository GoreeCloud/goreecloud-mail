import { createHash } from 'node:crypto';

import { requireSessionUser } from './session-context.js';
import { ProviderError, PROVIDER_ERROR_CODES } from '../web/providers/provider-error.js';
import { MAIL_PROVIDER_CAPABILITY } from '../web/mail-provider.js';
import { buildGmailRawMessage } from './gmail-message-builder.js';

const MAX_CLIENT_MUTATION_ID_CHARS = 256;
const WARDVEIL_SCAN_UNAVAILABLE = 'wardveil-scan-unavailable';

export class GmailAccountService {
  constructor({ accountService, gmailClientFactory, outgoingAttachmentSecurityGate = null }) {
    if (!accountService) throw new TypeError('accountService is required');
    if (typeof gmailClientFactory !== 'function') throw new TypeError('gmailClientFactory is required');
    if (
      outgoingAttachmentSecurityGate !== null &&
      typeof outgoingAttachmentSecurityGate?.authorize !== 'function'
    ) {
      throw new TypeError('outgoingAttachmentSecurityGate must expose authorize');
    }
    this.accountService = accountService;
    this.gmailClientFactory = gmailClientFactory;
    this.outgoingAttachmentSecurityGate = outgoingAttachmentSecurityGate;
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
    const authorizedMessage = await this.#authorizeOutgoingAttachments({
      context,
      message,
      action: 'send',
    });
    const reconciliationMessageId = deriveReconciliationMessageId({
      accountId: context.accountId,
      clientMutationId: authorizedMessage?.clientMutationId,
    });
    const built = buildGmailRawMessage({
      ...authorizedMessage,
      ...(reconciliationMessageId ? { messageId: reconciliationMessageId } : {}),
    });
    const client = this.gmailClientFactory(context);

    try {
      return await client.sendMessage(context, { raw: built.raw });
    } catch (error) {
      if (!reconciliationMessageId || !isAmbiguousWriteFailure(error)) throw error;
      return this.#reconcileAmbiguousSend({ client, context, messageId: reconciliationMessageId });
    }
  }

  async createDraft({ session, accountId, message }) {
    const context = await this.#writeContext({
      session,
      accountId,
      message,
      capability: MAIL_PROVIDER_CAPABILITY.DRAFTS,
    });
    const authorizedMessage = await this.#authorizeOutgoingAttachments({
      context,
      message,
      action: 'draft',
    });
    const reconciliationMessageId = deriveReconciliationMessageId({
      accountId: context.accountId,
      clientMutationId: authorizedMessage?.clientMutationId,
    });
    const built = buildGmailRawMessage({
      ...authorizedMessage,
      ...(reconciliationMessageId ? { messageId: reconciliationMessageId } : {}),
    }, { recipientRequired: false });
    const client = this.gmailClientFactory(context);

    try {
      return await client.createDraft(context, { raw: built.raw });
    } catch (error) {
      if (!reconciliationMessageId || !isAmbiguousWriteFailure(error)) throw error;
      return this.#reconcileAmbiguousDraft({
        client,
        context,
        messageId: reconciliationMessageId,
      });
    }
  }

  async updateDraft({ session, accountId, draftId, message }) {
    if (!draftId) throw new TypeError('draftId is required');
    const context = await this.#writeContext({
      session,
      accountId,
      message,
      capability: MAIL_PROVIDER_CAPABILITY.DRAFTS,
    });
    const authorizedMessage = await this.#authorizeOutgoingAttachments({
      context,
      message,
      action: 'draft',
    });
    const reconciliationMessageId = deriveReconciliationMessageId({
      accountId: context.accountId,
      clientMutationId: authorizedMessage?.clientMutationId,
    });
    const built = buildGmailRawMessage({
      ...authorizedMessage,
      ...(reconciliationMessageId ? { messageId: reconciliationMessageId } : {}),
    }, { recipientRequired: false });
    const client = this.gmailClientFactory(context);

    try {
      return await client.updateDraft(context, { draftId, raw: built.raw });
    } catch (error) {
      if (!reconciliationMessageId || !isAmbiguousWriteFailure(error)) throw error;
      return this.#reconcileAmbiguousDraft({
        client,
        context,
        draftId,
        messageId: reconciliationMessageId,
      });
    }
  }

  async #authorizeOutgoingAttachments({ context, message, action }) {
    const attachments = Array.isArray(message?.attachments) ? message.attachments : [];
    if (attachments.length === 0) return message;
    if (!this.outgoingAttachmentSecurityGate) {
      throw new ProviderError('Wardveil Scan authorization is required before Gmail can write outgoing attachments.', {
        code: WARDVEIL_SCAN_UNAVAILABLE,
        status: 503,
        retryable: true,
      });
    }
    const authorized = await this.outgoingAttachmentSecurityGate.authorize({
      accountId: context.accountId,
      message,
      action,
    });
    if (!authorized || !authorized.message) {
      throw new ProviderError('Wardveil Scan did not return an authorized outgoing attachment message.', {
        code: WARDVEIL_SCAN_UNAVAILABLE,
        status: 503,
        retryable: true,
      });
    }
    return authorized.message;
  }

  async #reconcileAmbiguousSend({ client, context, messageId }) {
    try {
      const matches = await client.findSentMessageByRfcMessageId(context, { messageId });
      if (matches.length === 1) {
        return Object.freeze({
          id: matches[0].id ? String(matches[0].id) : null,
          threadId: matches[0].threadId ? String(matches[0].threadId) : null,
          labelIds: ['SENT'],
          reconciled: true,
        });
      }
    } catch {
      // Reconciliation itself must never trigger a replay of the original write.
    }

    throw unknownWriteOutcome();
  }

  async #reconcileAmbiguousDraft({ client, context, draftId = null, messageId }) {
    try {
      const matches = await client.findDraftByRfcMessageId(context, { messageId });
      if (matches.length === 1 && (!draftId || matches[0].id === String(draftId))) {
        return Object.freeze({
          id: matches[0].id ? String(matches[0].id) : null,
          message: Object.freeze({
            id: matches[0].message?.id ? String(matches[0].message.id) : null,
            threadId: matches[0].message?.threadId ? String(matches[0].message.threadId) : null,
            labelIds: [],
          }),
          reconciled: true,
        });
      }
    } catch {
      // Reconciliation itself must never trigger a replay of the original write.
    }

    throw unknownWriteOutcome();
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

export function deriveReconciliationMessageId({ accountId, clientMutationId } = {}) {
  if (clientMutationId == null || clientMutationId === '') return null;
  if (typeof clientMutationId !== 'string') invalidMutationId();
  const normalized = clientMutationId.trim();
  if (!normalized || normalized.length > MAX_CLIENT_MUTATION_ID_CHARS || /[\r\n\0]/.test(normalized)) {
    invalidMutationId();
  }
  const digest = createHash('sha256')
    .update(String(accountId || ''))
    .update('\0')
    .update(normalized)
    .digest('hex');
  return `<goreecloud-${digest}@mail.goreecloud.invalid>`;
}

function isAmbiguousWriteFailure(error) {
  return error instanceof ProviderError && (
    error.code === PROVIDER_ERROR_CODES.TEMPORARY ||
    error.code === PROVIDER_ERROR_CODES.RATE_LIMITED ||
    error.code === PROVIDER_ERROR_CODES.UNKNOWN
  );
}

function unknownWriteOutcome() {
  return new ProviderError('The provider write outcome could not be confirmed; automatic replay is disabled.', {
    code: PROVIDER_ERROR_CODES.WRITE_OUTCOME_UNKNOWN,
    status: 502,
    retryable: false,
  });
}

function invalidMutationId() {
  throw new ProviderError('clientMutationId must be a bounded single-line string.', {
    code: PROVIDER_ERROR_CODES.INVALID_REQUEST,
    status: 400,
  });
}
