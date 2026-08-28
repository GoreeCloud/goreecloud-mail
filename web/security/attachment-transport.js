import { presentAttachmentSecurity } from './attachment-security-presentation.js';

export async function requestAttachmentTransport(provider, messageId, attachment, action) {
  if (!provider || typeof provider.retrieveAttachment !== 'function') {
    throw new TypeError('Mail provider attachment transport is unavailable.');
  }
  if (action !== 'open' && action !== 'download') {
    throw new TypeError('Attachment action must be open or download.');
  }
  if (!messageId || !attachment || !attachment.id) {
    throw new TypeError('Attachment transport requires message and attachment identity.');
  }

  const presentation = presentAttachmentSecurity(attachment.securityDecision);
  const allowed = action === 'open' ? presentation.canOpen : presentation.canDownload;
  if (!allowed) {
    return Object.freeze({
      status: 'blocked',
      action,
      presentation,
      transport: null,
    });
  }

  const transport = await provider.retrieveAttachment(messageId, attachment.id, action);
  if (!transport || typeof transport !== 'object') {
    throw new Error('Mail provider returned an invalid attachment transport result.');
  }
  return Object.freeze({
    status: 'ready',
    action,
    presentation,
    transport,
  });
}
