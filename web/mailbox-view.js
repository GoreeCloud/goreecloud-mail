export function filterLoadedMailboxMessages(messages, query) {
  const normalized = String(query ?? '').trim().toLowerCase();
  if (!normalized) return Array.isArray(messages) ? [...messages] : [];
  if (!Array.isArray(messages)) return [];

  return messages.filter((message) =>
    [message?.sender, message?.address, message?.subject, message?.preview, message?.body]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(normalized),
  );
}

export function mailboxName(mailboxes, mailboxId) {
  if (!Array.isArray(mailboxes)) return 'Mailbox';
  return mailboxes.find((mailbox) => mailbox?.id === mailboxId)?.name || 'Mailbox';
}
