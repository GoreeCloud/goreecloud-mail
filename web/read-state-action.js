export const MAIL_READ_STATE_ACTION = Object.freeze({
  MARK_READ: 'mark-read',
  MARK_UNREAD: 'mark-unread',
});

export function deriveReadStateAction(message) {
  if (!message || typeof message !== 'object') {
    return Object.freeze({
      available: false,
      action: null,
      targetRead: null,
      label: '',
      successLabel: '',
    });
  }

  const currentlyUnread = Boolean(message.unread);
  if (currentlyUnread) {
    return Object.freeze({
      available: true,
      action: MAIL_READ_STATE_ACTION.MARK_READ,
      targetRead: true,
      label: 'Mark read',
      successLabel: 'message marked read',
    });
  }

  return Object.freeze({
    available: true,
    action: MAIL_READ_STATE_ACTION.MARK_UNREAD,
    targetRead: false,
    label: 'Mark unread',
    successLabel: 'message marked unread',
  });
}

export function canExposeReadStateAction({ hasSelection, mutationInFlight, readStateCapability }) {
  return Boolean(hasSelection) && !Boolean(mutationInFlight) && Boolean(readStateCapability);
}
