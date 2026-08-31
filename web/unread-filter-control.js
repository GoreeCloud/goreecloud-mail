import { shouldShowRenderedMessage, unreadFilterStatus } from './unread-filter-presentation.js';

const topbar = document.querySelector('.topbar');
const searchField = document.querySelector('.search-field');
const messageList = document.querySelector('#messageList');

if (topbar && searchField && messageList) {
  const controls = document.createElement('div');
  controls.className = 'mailbox-view-controls';

  const unreadButton = document.createElement('button');
  unreadButton.id = 'unreadOnlyButton';
  unreadButton.type = 'button';
  unreadButton.className = 'mailbox-view-toggle';
  unreadButton.setAttribute('aria-pressed', 'false');
  unreadButton.textContent = 'Unread only';

  const status = document.createElement('span');
  status.id = 'unreadFilterStatus';
  status.className = 'sr-only';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  controls.append(searchField, unreadButton, status);
  topbar.append(controls);

  let unreadOnly = false;

  const applyPresentation = () => {
    const cards = Array.from(messageList.querySelectorAll('[data-message-id]'));
    let visibleCount = 0;
    for (const card of cards) {
      const show = shouldShowRenderedMessage({
        unreadOnly,
        unread: card.classList.contains('unread'),
      });
      card.hidden = !show;
      if (show) visibleCount += 1;
    }
    unreadButton.setAttribute('aria-pressed', String(unreadOnly));
    status.textContent = unreadFilterStatus({ unreadOnly, visibleCount });
  };

  unreadButton.addEventListener('click', () => {
    unreadOnly = !unreadOnly;
    applyPresentation();
  });

  new MutationObserver(applyPresentation).observe(messageList, {
    childList: true,
    subtree: false,
  });

  applyPresentation();
}
