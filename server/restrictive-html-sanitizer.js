const DROP_WITH_CONTENT = /<(script|style|iframe|object|embed|svg|math|form|template|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const DROP_TAGS = /<\/?(?:script|style|iframe|object|embed|svg|math|form|input|button|select|option|textarea|meta|link|base|template|noscript)\b[^>]*>/gi;
const COMMENT = /<!--[\s\S]*?-->/g;
const EVENT_ATTRIBUTE = /\s+on[a-z0-9_-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const STYLE_ATTRIBUTE = /\s+style\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const REMOTE_ATTRIBUTE = /\s+(?:src|srcset|background|poster)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const URL_ATTRIBUTE = /\s+(href|cite|action|formaction|xlink:href)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const ACTIVE_SCHEME = /^\s*(?:javascript|vbscript|data|file|blob):/i;
const SAFE_HREF = /^\s*(?:https:\/\/|mailto:|#|\/|\.\/|\.\.\/)/i;

/**
 * Conservative first-party sanitizer for email HTML.
 *
 * This is intentionally a reduction boundary rather than a general-purpose
 * web-page sanitizer. It removes executable/embedding elements, event/style
 * attributes, all automatic remote-resource attributes, and URL-bearing
 * attributes unless their value is from the explicitly permitted set.
 *
 * MessageContentPolicy still performs independent pre/post active-markup checks.
 */
export function sanitizeMessageHtml(input) {
  let html = String(input ?? '');
  html = html.replace(COMMENT, '');

  // Repeat container removal because hostile input can expose another blocked
  // container after one replacement pass.
  let previous;
  do {
    previous = html;
    html = html.replace(DROP_WITH_CONTENT, '');
  } while (html !== previous);

  html = html
    .replace(DROP_TAGS, '')
    .replace(EVENT_ATTRIBUTE, '')
    .replace(STYLE_ATTRIBUTE, '')
    .replace(REMOTE_ATTRIBUTE, '')
    .replace(URL_ATTRIBUTE, (match, name, quotedValue) => {
      const value = unquote(quotedValue).trim();
      if (!value || ACTIVE_SCHEME.test(value)) return '';
      if (name.toLowerCase() !== 'href') return '';
      if (!SAFE_HREF.test(value)) return '';
      return ` href="${escapeAttribute(value)}"`;
    });

  return html;
}

export function createRestrictiveMessageHtmlSanitizer() {
  return sanitizeMessageHtml;
}

function unquote(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function escapeAttribute(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
