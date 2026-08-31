export function shouldShowRenderedMessage({ unreadOnly, unread }) {
  return !unreadOnly || unread === true;
}

export function unreadFilterStatus({ unreadOnly, visibleCount }) {
  const count = Number.isInteger(visibleCount) && visibleCount >= 0 ? visibleCount : 0;
  if (!unreadOnly) return 'Showing the current loaded mailbox view.';
  return `Showing ${count} unread message${count === 1 ? '' : 's'} from the current loaded mailbox view.`;
}
