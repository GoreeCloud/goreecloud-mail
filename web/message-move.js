const NON_MOVE_DESTINATION_IDS = new Set(['starred', 'sent', 'drafts', 'trash']);

export function moveDestinationMailboxes(mailboxes, currentMailboxId) {
  const current = String(currentMailboxId ?? '').trim();
  const seen = new Set();
  const destinations = [];
  for (const mailbox of Array.isArray(mailboxes) ? mailboxes : []) {
    const id = String(mailbox?.id ?? '').trim();
    const name = String(mailbox?.name ?? '').trim();
    if (!id || !name || id === current || NON_MOVE_DESTINATION_IDS.has(id.toLowerCase()) || seen.has(id)) continue;
    seen.add(id);
    destinations.push(Object.freeze({ id, name }));
  }
  return destinations;
}
