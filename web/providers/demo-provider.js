import { normalizeCapabilities } from '../mail-provider.js';

const demoMessages = [
  {
    id: 'welcome-1',
    sender: 'GoreeCloud Mail',
    address: 'mail@goreecloud.local',
    subject: 'Welcome to the GoreeCloud Mail foundation',
    preview: 'The first provider-independent client shell is ready for development.',
    body: 'This local demonstration message verifies the initial mailbox shell without connecting to a real provider.',
    receivedAt: '2026-08-20T21:30:00-05:00',
    unread: true,
    flagged: false,
  },
  {
    id: 'security-1',
    sender: 'Wardveil Security',
    address: 'wardveil@goreecloud.local',
    subject: 'Remote content is protected',
    preview: 'External resources remain blocked in this development foundation.',
    body: 'Production message rendering will treat HTML, remote images, links, and attachments as untrusted input.',
    receivedAt: '2026-08-20T21:20:00-05:00',
    unread: false,
    flagged: true,
  },
];

export class DemoMailProvider {
  async authenticate() {
    return { authenticated: true, account: 'demo@goreecloud.local' };
  }

  async listMailboxes() {
    return [
      { id: 'inbox', name: 'Inbox', unread: 1 },
      { id: 'starred', name: 'Starred', unread: 0 },
      { id: 'sent', name: 'Sent', unread: 0 },
      { id: 'drafts', name: 'Drafts', unread: 0 },
      { id: 'archive', name: 'Archive', unread: 0 },
      { id: 'trash', name: 'Trash', unread: 0 },
    ];
  }

  async listMessages() {
    return structuredClone(demoMessages);
  }

  async getMessage(id) {
    return structuredClone(demoMessages.find((message) => message.id === id) ?? null);
  }

  async search(query) {
    const normalizedQuery = query.trim().toLowerCase();
    return structuredClone(
      demoMessages.filter((message) =>
        `${message.sender} ${message.address} ${message.subject} ${message.preview} ${message.body}`
          .toLowerCase()
          .includes(normalizedQuery),
      ),
    );
  }

  async send(message) {
    return { id: crypto.randomUUID(), status: 'demo-sent', message };
  }

  async createDraft(message) {
    return { id: crypto.randomUUID(), status: 'demo-draft', message };
  }

  async updateDraft(id, message) {
    return { id, status: 'demo-draft', message };
  }

  async move(id, mailboxId) {
    return { id, mailboxId };
  }

  async archive(id) {
    return { id, archived: true };
  }

  async remove(id) {
    return { id, removed: true };
  }

  async flag(id, flagged = true) {
    return { id, flagged };
  }

  async sync() {
    return { synchronized: true, mode: 'demo' };
  }

  async capabilities() {
    return normalizeCapabilities({
      archive: true,
      drafts: true,
      flags: true,
      folders: true,
      search: true,
      send: true,
      threads: false,
    });
  }
}
