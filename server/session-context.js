export class AuthenticationRequiredError extends Error {
  constructor(message = 'Authentication is required.') {
    super(message);
    this.name = 'AuthenticationRequiredError';
    this.status = 401;
    this.code = 'authentication-required';
  }
}

/**
 * Resolve the GoreeCloud Mail user identity from trusted server session state.
 *
 * The caller must pass session data produced by the server-side authentication
 * middleware. User identifiers supplied by query strings, request bodies, or
 * provider paths are intentionally ignored by this boundary.
 */
export function requireSessionUser(session) {
  const userId = typeof session?.userId === 'string' ? session.userId.trim() : '';
  if (!userId) throw new AuthenticationRequiredError();

  return Object.freeze({ userId });
}
