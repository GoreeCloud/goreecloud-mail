const UNSAFE_HTML_TAGS = /<(script|iframe|object|embed|form|input|button|meta|link|base|svg|math)(\s|>|\/)/i;
const INLINE_EVENT_HANDLER = /\son[a-z]+\s*=/i;
const ACTIVE_URL = /(?:javascript|vbscript|data)\s*:/i;

export class UnsafeMessageHtmlError extends Error {
  constructor() {
    super('Message HTML requires an approved sanitizer before rendering.');
    this.name = 'UnsafeMessageHtmlError';
    this.status = 422;
    this.code = 'unsafe-message-html';
  }
}

/**
 * Trusted message-content boundary.
 *
 * Production HTML rendering must inject an approved sanitizer implementation.
 * Without one, HTML fails closed and callers may render the escaped plain-text
 * representation instead. The lightweight checks below are defense in depth,
 * never a substitute for the sanitizer.
 */
export class MessageContentPolicy {
  constructor({ sanitizeHtml = null } = {}) {
    if (sanitizeHtml !== null && typeof sanitizeHtml !== 'function') {
      throw new TypeError('sanitizeHtml must be a function when provided');
    }
    this.sanitizeHtml = sanitizeHtml;
  }

  render({ html = null, text = null }) {
    if (html) {
      if (!this.sanitizeHtml) throw new UnsafeMessageHtmlError();
      this.#rejectObviouslyActiveMarkup(html);
      const sanitized = this.sanitizeHtml(html);
      if (typeof sanitized !== 'string') throw new TypeError('sanitizeHtml must return a string');
      this.#rejectObviouslyActiveMarkup(sanitized);
      return Object.freeze({ kind: 'html', content: sanitized, remoteContentAllowed: false });
    }

    return Object.freeze({
      kind: 'text',
      content: escapeHtml(text || ''),
      remoteContentAllowed: false,
    });
  }

  #rejectObviouslyActiveMarkup(html) {
    if (UNSAFE_HTML_TAGS.test(html) || INLINE_EVENT_HANDLER.test(html) || ACTIVE_URL.test(html)) {
      throw new UnsafeMessageHtmlError();
    }
  }
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
