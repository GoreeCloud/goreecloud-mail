export function filterLoadedMailboxMessages(messages, query, { unreadOnly = false } = {}) {
  if (!Array.isArray(messages)) return [];

  const normalized = String(query ?? '').trim().toLowerCase();
  return messages.filter((message) => {
    if (unreadOnly && message?.unread !== true) return false;
    if (!normalized) return true;
    return [message?.sender, message?.address, message?.subject, message?.preview, message?.body]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(normalized);
  });
}

export function mailboxName(mailboxes, mailboxId) {
  if (!Array.isArray(mailboxes)) return 'Mailbox';
  return mailboxes.find((mailbox) => mailbox?.id === mailboxId)?.name || 'Mailbox';
}
