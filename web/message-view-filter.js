export const MESSAGE_VIEW_FILTER = Object.freeze({
  ALL: 'all',
  UNREAD: 'unread',
  FLAGGED: 'flagged',
  UNREAD_FLAGGED: 'unread-flagged',
});

const MESSAGE_VIEW_FILTER_VALUES = new Set(Object.values(MESSAGE_VIEW_FILTER));

export function normalizeMessageViewFilter(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return MESSAGE_VIEW_FILTER_VALUES.has(normalized)
    ? normalized
    : MESSAGE_VIEW_FILTER.ALL;
}

export function shouldShowLoadedMessage({ filter, unread, flagged }) {
  switch (normalizeMessageViewFilter(filter)) {
    case MESSAGE_VIEW_FILTER.UNREAD:
      return unread === true;
    case MESSAGE_VIEW_FILTER.FLAGGED:
      return flagged === true;
    case MESSAGE_VIEW_FILTER.UNREAD_FLAGGED:
      return unread === true && flagged === true;
    default:
      return true;
  }
}

export function messageViewFilterStatus({ filter, visibleCount }) {
  const normalized = normalizeMessageViewFilter(filter);
  const count = Number.isInteger(visibleCount) && visibleCount >= 0 ? visibleCount : 0;
  const noun = count === 1 ? 'message' : 'messages';

  switch (normalized) {
    case MESSAGE_VIEW_FILTER.UNREAD:
      return `Showing ${count} unread ${noun} from the current loaded mailbox view.`;
    case MESSAGE_VIEW_FILTER.FLAGGED:
      return `Showing ${count} flagged ${noun} from the current loaded mailbox view.`;
    case MESSAGE_VIEW_FILTER.UNREAD_FLAGGED:
      return `Showing ${count} unread flagged ${noun} from the current loaded mailbox view.`;
    default:
      return 'Showing the current loaded mailbox view.';
  }
}
