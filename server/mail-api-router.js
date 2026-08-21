import { AuthenticationRequiredError } from './session-context.js';
import { ProviderAccountNotFoundError } from './provider-account-registry.js';
import { ProviderError, publicProviderError } from '../web/providers/provider-error.js';

export async function routeMailApi({ method, pathname, session, body = null, accountService }) {
  if (!accountService) throw new TypeError('accountService is required');

  try {
    if (method === 'GET' && pathname === '/api/mail/accounts') {
      return response(200, { accounts: accountService.list({ session }) });
    }

    if (method === 'POST' && pathname === '/api/mail/accounts') {
      const provider = cleanString(body?.provider);
      if (!provider) return response(400, { error: { code: 'invalid-request', message: 'provider is required', retryable: false } });

      const account = accountService.create({
        session,
        provider,
        externalAccountId: nullableString(body?.externalAccountId),
        displayName: nullableString(body?.displayName),
      });
      return response(201, { account });
    }

    const match = pathname.match(/^\/api\/mail\/accounts\/([^/]+)$/);
    if (match) {
      const accountId = decodeURIComponent(match[1]);
      if (method === 'GET') return response(200, { account: accountService.get({ session, accountId }) });
      if (method === 'DELETE') return response(200, accountService.remove({ session, accountId }));
    }

    return response(404, { error: { code: 'route-not-found', message: 'Mail API route was not found.', retryable: false } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return response(401, { error: { code: error.code, message: error.message, retryable: false } });
    }
    if (error instanceof ProviderAccountNotFoundError) {
      return response(404, { error: { code: error.code, message: error.message, retryable: false } });
    }
    if (error instanceof ProviderError || error?.status) {
      const status = Number(error.status) || 502;
      return response(status, publicProviderError(error));
    }
    throw error;
  }
}

function response(status, body) {
  return Object.freeze({ status, body: structuredClone(body) });
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function nullableString(value) {
  const cleaned = cleanString(value);
  return cleaned || null;
}
