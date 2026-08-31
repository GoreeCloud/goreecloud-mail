import {
  MESSAGE_VIEW_FILTER,
  messageViewFilterStatus,
  normalizeMessageViewFilter,
  shouldShowLoadedMessage,
} from './message-view-filter.js';

const topbar = document.querySelector('.topbar');
const searchField = document.querySelector('.search-field');
const messageList = document.querySelector('#messageList');

if (topbar && searchField && messageList) {
  const controls = document.createElement('div');
  controls.className = 'mailbox-view-controls';

  const filterLabel = document.createElement('label');
  filterLabel.className = 'mailbox-view-filter';
  filterLabel.htmlFor = 'messageViewFilter';

  const filterCaption = document.createElement('span');
  filterCaption.textContent = 'View';

  const filterSelect = document.createElement('select');
  filterSelect.id = 'messageViewFilter';
  filterSelect.setAttribute('aria-describedby', 'messageViewFilterStatus');
  for (const [value, label] of [
    [MESSAGE_VIEW_FILTER.ALL, 'All loaded'],
    [MESSAGE_VIEW_FILTER.UNREAD, 'Unread'],
    [MESSAGE_VIEW_FILTER.FLAGGED, 'Flagged'],
    [MESSAGE_VIEW_FILTER.UNREAD_FLAGGED, 'Unread + flagged'],
  ]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    filterSelect.append(option);
  }

  const status = document.createElement('span');
  status.id = 'messageViewFilterStatus';
  status.className = 'sr-only';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  filterLabel.append(filterCaption, filterSelect);
  controls.append(searchField, filterLabel, status);
  topbar.append(controls);

  let currentFilter = MESSAGE_VIEW_FILTER.ALL;

  const applyPresentation = () => {
    const cards = Array.from(messageList.querySelectorAll('[data-message-id]'));
    let visibleCount = 0;
    for (const card of cards) {
      const meta = card.querySelector('.message-meta')?.textContent ?? '';
      const show = shouldShowLoadedMessage({
        filter: currentFilter,
        unread: card.classList.contains('unread'),
        flagged: meta.trim().startsWith('★'),
      });
      card.hidden = !show;
      if (show) visibleCount += 1;
    }
    status.textContent = messageViewFilterStatus({
      filter: currentFilter,
      visibleCount,
    });
  };

  filterSelect.addEventListener('change', () => {
    currentFilter = normalizeMessageViewFilter(filterSelect.value);
    filterSelect.value = currentFilter;
    applyPresentation();
  });

  new MutationObserver(applyPresentation).observe(messageList, {
    childList: true,
    subtree: false,
  });

  applyPresentation();
}
