import { materializeComposeAttachments } from './compose-attachments.js';
import { buildForwardCompose, buildReplyCompose } from './compose-context.js';
import { readMailProviderRuntime } from './provider-runtime.js';
import { presentAttachmentSecurity } from './security/attachment-security-presentation.js';

const runtimeResult = (() => {
  try {
    return { runtime: readMailProviderRuntime() };
  } catch (error) {
    return { error };
  }
})();
const runtime = runtimeResult.runtime ?? null;
const provider = runtime?.provider ?? null;

const mailboxList = document.querySelector('#mailboxList');
const messageList = document.querySelector('#messageList');
const searchInput = document.querySelector('#searchInput');
const composeButton = document.querySelector('#composeButton');
const composeDialog = document.querySelector('#composeDialog');
const composeForm = document.querySelector('#composeForm');
const composeEyebrow = document.querySelector('#composeEyebrow');
const composeTitle = document.querySelector('#composeTitle');
const composeStatus = document.querySelector('#composeStatus');
const composeAttachments = document.querySelector('#composeAttachments');
const composeAttachmentPreview = document.querySelector('#composeAttachmentPreview');
const composeDraftButton = composeForm.querySelector('.draft-button');
const composeSendButton = composeForm.querySelector('.send-button');
const providerStatus = document.querySelector('#providerStatus');
const emptyReader = document.querySelector('#emptyReader');
const messageReader = document.querySelector('#messageReader');
const readerSubject = document.querySelector('#readerSubject');
const readerSender = document.querySelector('#readerSender');
const readerAddress = document.querySelector('#readerAddress');
const readerDate = document.querySelector('#readerDate');
const readerBody = document.querySelector('#readerBody');
const readerAvatar = document.querySelector('#readerAvatar');
const readerAttachments = document.querySelector('#readerAttachments');
const readerAttachmentStatus = document.querySelector('#readerAttachmentStatus');
const replyButton = document.querySelector('#replyButton');
const forwardButton = document.querySelector('#forwardButton');
const flagButton = document.querySelector('#flagButton');

let messages = [];
let selectedMessageId = null;
let selectedMessage = null;
let selectedComposeAttachments = [];

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatBytes(value) {
  const bytes = Number.isFinite(value) && value >= 0 ? value : 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function optionalComposeField(formData, name) {
  const value = String(formData.get(name) ?? '').trim();
  return value || null;
}

function setComposeField(name, value) {
  const field = composeForm.elements.namedItem(name);
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
    field.value = String(value ?? '');
  }
}

function openCompose({
  eyebrow = 'New message',
  title = 'Compose',
  to = '',
  cc = '',
  bcc = '',
  subject = '',
  body = '',
  status = '',
  focus = 'to',
} = {}) {
  composeForm.reset();
  clearComposeAttachmentPreview();
  composeAttachments.value = '';
  composeEyebrow.textContent = eyebrow;
  composeTitle.textContent = title;
  composeStatus.textContent = status;
  setComposeField('to', to);
  setComposeField('cc', cc);
  setComposeField('bcc', bcc);
  setComposeField('subject', subject);
  setComposeField('body', body);
  composeDialog.showModal();
  const focusTarget = composeForm.elements.namedItem(focus);
  if (focusTarget instanceof HTMLElement) focusTarget.focus();
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

function renderAttachments(attachments = []) {
  readerAttachmentStatus.textContent = '';
  if (!Array.isArray(attachments) || attachments.length === 0) {
    readerAttachments.hidden = true;
    readerAttachments.replaceChildren();
    return;
  }

  readerAttachments.hidden = false;
  readerAttachments.replaceChildren(
    ...attachments.map((attachment) => {
      const presentation = presentAttachmentSecurity(attachment.securityDecision);
      const card = document.createElement('article');
      card.className = `attachment-card attachment-${presentation.state}`;

      const heading = document.createElement('div');
      heading.className = 'attachment-heading';
      const filename = document.createElement('strong');
      filename.textContent = attachment.filename || 'Unnamed attachment';
      const size = document.createElement('span');
      size.textContent = formatBytes(attachment.size);
      heading.append(filename, size);

      const security = document.createElement('div');
      security.className = 'attachment-security-state';
      const stateHeadline = document.createElement('strong');
      stateHeadline.textContent = presentation.headline;
      const stateDetail = document.createElement('span');
      stateDetail.textContent = presentation.detail;
      security.append(stateHeadline, stateDetail);

      const actions = document.createElement('div');
      actions.className = 'attachment-actions';
      for (const [action, allowed] of [
        ['open', presentation.canOpen],
        ['download', presentation.canDownload],
      ]) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.attachmentAction = action;
        button.dataset.attachmentId = attachment.id || '';
        button.disabled = !allowed;
        button.textContent = action === 'open' ? 'Open' : 'Download';
        if (!allowed) button.title = presentation.headline;
        actions.append(button);
      }

      if (presentation.showEvidence) {
        const evidence = document.createElement('details');
        evidence.className = 'attachment-evidence';
        const summary = document.createElement('summary');
        summary.textContent = 'Security evidence';
        const list = document.createElement('ul');
        for (const reference of presentation.evidenceRefs) {
          const item = document.createElement('li');
          item.textContent = reference;
          list.append(item);
        }
        evidence.append(summary, list);
        card.append(heading, security, actions, evidence);
      } else {
        card.append(heading, security, actions);
      }
      return card;
    }),
  );
}

function clearComposeAttachmentPreview() {
  selectedComposeAttachments = [];
  composeAttachmentPreview.hidden = true;
  composeAttachmentPreview.replaceChildren();
}

function renderComposeAttachmentPreview(files, materialized) {
  selectedComposeAttachments = materialized;
  if (materialized.length === 0) {
    clearComposeAttachmentPreview();
    return;
  }

  composeAttachmentPreview.hidden = false;
  composeAttachmentPreview.replaceChildren(
    ...materialized.map((attachment, index) => {
      const row = document.createElement('div');
      row.className = 'compose-attachment-row';
      const name = document.createElement('strong');
      name.textContent = attachment.filename;
      const detail = document.createElement('span');
      detail.textContent = `${formatBytes(files[index]?.size ?? 0)} · ${attachment.contentType}`;
      row.append(name, detail);
      return row;
    }),
  );
}

async function openMessage(id) {
  const message = await provider.getMessage(id);
  if (!message) return;

  selectedMessageId = id;
  selectedMessage = message;
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
  renderAttachments(message.attachments);
  renderMessages(messages);
}

async function initialize() {
  if (!runtime || !provider) {
    throw runtimeResult.error ?? new Error('Mail provider runtime is unavailable.');
  }
  providerStatus.textContent = runtime.label;
  composeDraftButton.textContent = runtime.mode === 'gateway' ? 'Save draft' : 'Save demo draft';
  composeSendButton.textContent = runtime.mode === 'gateway' ? 'Send message' : 'Send demo message';
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
  if (!card || !provider) return;
  await openMessage(card.dataset.messageId);
});

readerAttachments.addEventListener('click', (event) => {
  const button = event.target.closest('[data-attachment-action]');
  if (!button || button.disabled) return;
  const actionLabel = button.dataset.attachmentAction === 'open' ? 'Open' : 'Download';
  readerAttachmentStatus.textContent = `${actionLabel} is security-authorized for this evidence state, but browser attachment retrieval remains outside this development slice.`;
});

searchInput.addEventListener('input', async () => {
  if (!provider) return;
  const query = searchInput.value.trim();
  if (!query) {
    renderMessages(messages);
    return;
  }
  renderMessages(await provider.search(query));
});

composeButton.addEventListener('click', () => openCompose());

replyButton.addEventListener('click', () => {
  if (!selectedMessage) return;
  const context = buildReplyCompose(selectedMessage, formatDate(selectedMessage.receivedAt));
  openCompose({
    eyebrow: 'Reply',
    title: `Reply to ${selectedMessage.sender}`,
    ...context,
    status: 'Plain-text reply context prepared locally. Original attachments are not copied automatically.',
    focus: 'body',
  });
});

forwardButton.addEventListener('click', () => {
  if (!selectedMessage) return;
  const context = buildForwardCompose(selectedMessage, formatDate(selectedMessage.receivedAt));
  openCompose({
    eyebrow: 'Forward',
    title: 'Forward message',
    ...context,
    status: 'Forward context prepared locally. Original attachments are not copied automatically.',
    focus: 'to',
  });
});

composeAttachments.addEventListener('change', async () => {
  composeStatus.textContent = '';
  const files = Array.from(composeAttachments.files ?? []);
  try {
    const materialized = await materializeComposeAttachments(files);
    renderComposeAttachmentPreview(files, materialized);
    if (materialized.length > 0) {
      composeStatus.textContent = runtime?.canSendAttachments
        ? `${materialized.length} attachment${materialized.length === 1 ? '' : 's'} validated locally. The authenticated gateway remains responsible for authoritative Wardveil acceptance before provider write.`
        : `${materialized.length} attachment${materialized.length === 1 ? '' : 's'} validated locally. Demo mode never transmits attachment bytes.`;
    }
  } catch (error) {
    clearComposeAttachmentPreview();
    composeAttachments.value = '';
    composeStatus.textContent = error instanceof Error ? error.message : 'The selected attachments could not be validated.';
  }
});

composeForm.addEventListener('submit', async (event) => {
  const operation = event.submitter?.value;
  if (operation !== 'send' && operation !== 'draft') return;

  event.preventDefault();
  if (!runtime || !provider) {
    composeStatus.textContent = 'Mail provider runtime is unavailable.';
    return;
  }
  if (selectedComposeAttachments.length > 0 && !runtime.canSendAttachments) {
    composeStatus.textContent = operation === 'draft'
      ? 'Attachment draft saving is blocked in demo mode. Attachment bytes remain local.'
      : 'Attachment sending is blocked in demo mode. Attachment bytes remain local.';
    return;
  }

  const formData = new FormData(composeForm);
  const cc = optionalComposeField(formData, 'cc');
  const bcc = optionalComposeField(formData, 'bcc');
  const payload = {
    to: formData.get('to'),
    ...(cc ? { cc } : {}),
    ...(bcc ? { bcc } : {}),
    subject: formData.get('subject'),
    body: formData.get('body'),
    ...(selectedComposeAttachments.length > 0 ? { attachments: selectedComposeAttachments } : {}),
  };

  try {
    if (operation === 'draft') {
      await provider.createDraft(payload);
      composeStatus.textContent = runtime.mode === 'gateway'
        ? 'Draft accepted by the authenticated gateway path.'
        : 'Demo draft saved locally.';
    } else {
      await provider.send(payload);
      composeStatus.textContent = runtime.mode === 'gateway'
        ? 'Message accepted by the authenticated gateway path.'
        : 'Demo send completed locally.';
    }
    composeForm.reset();
    clearComposeAttachmentPreview();
    setTimeout(() => composeDialog.close(), 500);
  } catch (error) {
    composeStatus.textContent = error instanceof Error
      ? error.message
      : operation === 'draft'
        ? 'The draft could not be saved.'
        : 'The message could not be sent.';
  }
});

flagButton.addEventListener('click', async () => {
  if (!selectedMessageId || !provider) return;
  const current = messages.find((message) => message.id === selectedMessageId);
  if (!current) return;

  current.flagged = !current.flagged;
  await provider.flag(selectedMessageId, current.flagged);
  flagButton.textContent = current.flagged ? '★' : '☆';
  flagButton.setAttribute('aria-pressed', String(current.flagged));
  if (selectedMessage) selectedMessage.flagged = current.flagged;
  renderMessages(messages);
});

initialize().catch((error) => {
  console.error('Unable to initialize GoreeCloud Mail development shell.', error);
  composeButton.disabled = true;
  composeDraftButton.disabled = true;
  composeSendButton.disabled = true;
  replyButton.disabled = true;
  forwardButton.disabled = true;
  providerStatus.textContent = 'Provider unavailable';
  messageList.textContent = 'Unable to initialize the configured development mail provider.';
});
