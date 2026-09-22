import type { Response } from 'express';
import { env } from './env';

export const AUTH_COOKIE_NAME = 'access_token';

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: 'lax',
    maxAge: env.jwtExpiresInSeconds * 1000,
    path: '/',
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, { httpOnly: true, secure: env.cookieSecure, sameSite: 'lax', path: '/' });
}
