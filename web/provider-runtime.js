import { validateMailProvider } from './mail-provider.js';
import { DemoMailProvider } from './providers/demo-provider.js';
import { GatewayMailProvider } from './providers/gateway-mail-provider.js';
import { ProviderGateway } from './providers/provider-gateway.js';

const PROVIDER_META = 'goreecloud-mail-provider';
const ACCOUNT_META = 'goreecloud-mail-account';
const GATEWAY_META = 'goreecloud-mail-gateway';
const CANONICAL_GATEWAY_ORIGIN = 'https://goreecloud.invalid';

export function createMailProviderRuntime({
  mode = 'demo',
  accountId = '',
  gatewayBaseUrl = '/api/mail',
  fetchImpl = globalThis.fetch?.bind(globalThis),
} = {}) {
  const normalizedMode = String(mode).trim().toLowerCase();
  if (normalizedMode === 'demo') {
    return Object.freeze({
      provider: validateMailProvider(new DemoMailProvider()),
      mode: 'demo',
      label: 'Demo provider',
      canSendAttachments: false,
    });
  }

  if (normalizedMode !== 'gateway') {
    throw new Error('Unsupported GoreeCloud Mail provider mode.');
  }

  if (typeof accountId !== 'string' || !accountId || accountId !== accountId.trim()) {
    throw new Error('Authenticated gateway mode requires an exact non-secret account identifier.');
  }
  if (typeof fetchImpl !== 'function') {
    throw new Error('Authenticated gateway mode requires the browser fetch implementation.');
  }

  const normalizedGatewayBase = normalizeSameOriginGatewayBase(gatewayBaseUrl);
  const gateway = new ProviderGateway({ baseUrl: normalizedGatewayBase, fetchImpl });
  return Object.freeze({
    provider: validateMailProvider(new GatewayMailProvider({ accountId, gateway })),
    mode: 'gateway',
    label: 'Authenticated gateway',
    canSendAttachments: true,
  });
}

export function readMailProviderRuntime(documentRef = globalThis.document, fetchImpl = globalThis.fetch?.bind(globalThis)) {
  const meta = (name) => documentRef?.querySelector?.(`meta[name="${name}"]`)?.content ?? '';
  return createMailProviderRuntime({
    mode: meta(PROVIDER_META) || 'demo',
    accountId: meta(ACCOUNT_META),
    gatewayBaseUrl: meta(GATEWAY_META) || '/api/mail',
    fetchImpl,
  });
}

export function normalizeSameOriginGatewayBase(value) {
  const base = String(value ?? '').trim();
  if (!base.startsWith('/') || base.startsWith('//')) {
    throw new Error('Mail gateway base must be a same-origin absolute path.');
  }
  if (base.includes('?') || base.includes('#') || /[\r\n\0]/u.test(base)) {
    throw new Error('Mail gateway base contains unsupported URL components.');
  }

  const collapsed = base.replace(/\/+$/u, '') || '/';
  if (collapsed.includes('\\') || collapsed.includes('%')) {
    throw new Error('Mail gateway base must use an unambiguous canonical path.');
  }

  let parsed;
  try {
    parsed = new URL(collapsed, CANONICAL_GATEWAY_ORIGIN);
  } catch {
    throw new Error('Mail gateway base must use an unambiguous canonical path.');
  }
  if (
    parsed.origin !== CANONICAL_GATEWAY_ORIGIN ||
    parsed.pathname !== collapsed ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error('Mail gateway base must use an unambiguous canonical path.');
  }

  return collapsed;
}
