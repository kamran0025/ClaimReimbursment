import type { CookieOptions, Response } from 'express';
import { env } from './env';

export const AUTH_COOKIE_NAME = 'access_token';

/**
 * `SameSite=None` is required for the cookie to ride along on a
 * cross-*site* request — e.g. a frontend on `localhost:5173` (or any
 * separately-hosted deployment) calling a backend on a different
 * registrable domain (`*.onrender.com`, say). But browsers reject
 * `SameSite=None` unless `Secure` is also set, and `Secure` cookies are
 * dropped over plain HTTP — which local dev (backend on `http://localhost`)
 * still uses. So this must track `COOKIE_SECURE` (true in any real HTTPS
 * deployment, false for local HTTP dev), not be a fixed value: `lax` +
 * non-secure locally (same-site enough there — see cookies.ts's git
 * history for the incident this fixes), `none` + secure everywhere else.
 */
const cookieSecurityOptions: Pick<CookieOptions, 'secure' | 'sameSite'> = env.cookieSecure
  ? { secure: true, sameSite: 'none' }
  : { secure: false, sameSite: 'lax' };

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    ...cookieSecurityOptions,
    maxAge: env.jwtExpiresInSeconds * 1000,
    path: '/',
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, { httpOnly: true, ...cookieSecurityOptions, path: '/' });
}
