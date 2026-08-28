import { createHash, randomBytes } from 'node:crypto';

export const GMAIL_AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GMAIL_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

export function createPkcePair() {
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return Object.freeze({ verifier, challenge, method: 'S256' });
}

export function buildGmailAuthorizationUrl({ clientId, redirectUri, state, codeChallenge, scopes = defaultGmailScopes() }) {
  for (const [name, value] of Object.entries({ clientId, redirectUri, state, codeChallenge })) {
    if (!value) throw new TypeError(`${name} is required`);
  }

  const url = new URL(GMAIL_AUTHORIZATION_ENDPOINT);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', [...new Set(scopes)].join(' '));
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('prompt', 'consent');
  return url.toString();
}

export function buildGmailTokenExchangeBody({ clientId, clientSecret = null, redirectUri, code, codeVerifier }) {
  for (const [name, value] of Object.entries({ clientId, redirectUri, code, codeVerifier })) {
    if (!value) throw new TypeError(`${name} is required`);
  }

  const body = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    code,
    code_verifier: codeVerifier,
    grant_type: 'authorization_code',
  });
  if (clientSecret) body.set('client_secret', clientSecret);
  return body;
}

export function defaultGmailScopes() {
  return [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.compose',
  ];
}
