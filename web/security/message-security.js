const SAFE_SCHEMES = new Set(['https:', 'mailto:']);
const BLOCKED_SCHEMES = new Set(['javascript:', 'data:', 'file:', 'vbscript:']);

export function classifyMessageUrl(value, { baseUrl = 'https://mail.goreecloud.invalid/' } = {}) {
  if (typeof value !== 'string' || value.trim() === '') {
    return Object.freeze({ allowed: false, reason: 'empty', url: null });
  }

  let url;
  try {
    url = new URL(value, baseUrl);
  } catch {
    return Object.freeze({ allowed: false, reason: 'invalid', url: null });
  }

  if (BLOCKED_SCHEMES.has(url.protocol)) {
    return Object.freeze({ allowed: false, reason: 'blocked-scheme', url: url.href });
  }

  if (!SAFE_SCHEMES.has(url.protocol)) {
    return Object.freeze({ allowed: false, reason: 'unsupported-scheme', url: url.href });
  }

  return Object.freeze({
    allowed: true,
    reason: url.protocol === 'mailto:' ? 'mail-address' : 'secure-web',
    url: url.href,
    external: url.protocol === 'https:' && url.origin !== new URL(baseUrl).origin,
  });
}

export function remoteContentPolicy({ trustedSender = false, userApproved = false } = {}) {
  const allowed = Boolean(trustedSender && userApproved);
  return Object.freeze({
    allowed,
    mode: allowed ? 'approved' : 'blocked',
    reason: allowed ? 'sender-and-user-approved' : 'privacy-by-default',
  });
}
