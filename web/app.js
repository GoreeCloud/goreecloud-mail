import { validateMailProvider } from './mail-provider.js';
import { DemoMailProvider } from './providers/demo-provider.js';

const provider = validateMailProvider(new DemoMailProvider());

const mailboxList = document.querySelector('#mailboxList');
const messageList = document.querySelector('#messageList');
const searchInput = document.querySelector('#searchInput');
const composeButton = document.querySelector('#composeButton');
const composeDialog = document.querySelector('#composeDialog');
const composeForm = document.querySelector('#composeForm');
const composeStatus = document.querySelector('#composeStatus');
const emptyReader = document.querySelector('#emptyReader');
const messageReader = document.querySelector('#messageReader');
const readerSubject = document.querySelector('#readerSubject');
const readerSender = document.querySelector('#readerSender');
const readerAddress = document.querySelector('#readerAddress');
const readerDate = document.querySelector('#readerDate');
const readerBody = document.querySelector('#readerBody');
const readerAvatar = document.querySelector('#readerAvatar');
const flagButton = document.querySelector('#flagButton');

let messages = [];
let selectedMessageId = null;

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function renderMailboxes(mailboxes) {
  mailboxList.replaceChildren(
    ...mailboxes.map((mailbox, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mailbox-button';
      button.dataset.mailboxId = mailbox.id;
      if (index === 0) button.setAttribute('aria-current', 'page');

      const label = document.createElement('span');
      label.textContent = mailbox.name;

      const count = document.createElement('span');
      count.className = 'mailbox-count';
      count.textContent = String(mailbox.unread ?? 0);

      button.append(label, count);
      return button;
    }),
  );
}

function renderMessages(items) {
  if (items.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'message-preview';
    empty.textContent = 'No messages found.';
    messageList.replaceChildren(empty);
    return;
  }

  messageList.replaceChildren(
    ...items.map((message) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `message-card${message.unread ? ' unread' : ''}`;
      card.dataset.messageId = message.id;
      card.setAttribute('aria-current', String(message.id === selectedMessageId));

      const topline = document.createElement('div');
      topline.className = 'message-topline';

      const sender = document.createElement('strong');
      sender.className = 'message-sender';
      sender.textContent = message.sender;

      const meta = document.createElement('span');
      meta.className = 'message-meta';
      meta.textContent = `${message.flagged ? '★ · ' : ''}${formatDate(message.receivedAt)}`;

      const subject = document.createElement('div');
      subject.className = 'message-subject';
      subject.textContent = message.subject;

      const preview = document.createElement('p');
      preview.className = 'message-preview';
      preview.textContent = message.preview;

      topline.append(sender, meta);
      card.append(topline, subject, preview);
      return card;
    }),
  );
}

async function openMessage(id) {
  const message = await provider.getMessage(id);
  if (!message) return;

  selectedMessageId = id;
  emptyReader.hidden = true;
  messageReader.hidden = false;
  readerSubject.textContent = message.subject;
  readerSender.textContent = message.sender;
  readerAddress.textContent = message.address;
  readerDate.textContent = formatDate(message.receivedAt);
  readerDate.dateTime = message.receivedAt;
  readerBody.textContent = message.body;
  readerAvatar.textContent = message.sender.slice(0, 1).toUpperCase();
  flagButton.textContent = message.flagged ? '★' : '☆';
  flagButton.setAttribute('aria-pressed', String(message.flagged));
  renderMessages(messages);
}

async function initialize() {
  await provider.authenticate();
  const [mailboxes, loadedMessages] = await Promise.all([
    provider.listMailboxes(),
    provider.listMessages('inbox'),
  ]);
  messages = loadedMessages;
  renderMailboxes(mailboxes);
  renderMessages(messages);
}

messageList.addEventListener('click', async (event) => {
  const card = event.target.closest('[data-message-id]');
  if (!card) return;
  await openMessage(card.dataset.messageId);
});

searchInput.addEventListener('input', async () => {
  const query = searchInput.value.trim();
  if (!query) {
    renderMessages(messages);
    return;
  }
  renderMessages(await provider.search(query));
});

composeButton.addEventListener('click', () => {
  composeStatus.textContent = '';
  composeDialog.showModal();
});

composeForm.addEventListener('submit', async (event) => {
  const submitter = event.submitter;
  if (!submitter || submitter.value !== 'send') return;

  event.preventDefault();
  const formData = new FormData(composeForm);
  const payload = {
    to: formData.get('to'),
    subject: formData.get('subject'),
    body: formData.get('body'),
  };

  await provider.send(payload);
  composeStatus.textContent = 'Demo send completed locally.';
  composeForm.reset();
  setTimeout(() => composeDialog.close(), 500);
});

flagButton.addEventListener('click', async () => {
  if (!selectedMessageId) return;
  const current = messages.find((message) => message.id === selectedMessageId);
  if (!current) return;

  current.flagged = !current.flagged;
  await provider.flag(selectedMessageId, current.flagged);
  flagButton.textContent = current.flagged ? '★' : '☆';
  flagButton.setAttribute('aria-pressed', String(current.flagged));
  renderMessages(messages);
});

initialize().catch((error) => {
  console.error('Unable to initialize GoreeCloud Mail development shell.', error);
  messageList.textContent = 'Unable to initialize the development mail provider.';
});
