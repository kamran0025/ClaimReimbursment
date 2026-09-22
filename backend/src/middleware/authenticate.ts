import type { NextFunction, Request, Response } from 'express';
import { AUTH_COOKIE_NAME } from '../lib/cookies';
import { getUserById, verifyToken } from '../services/authService';
import { ApiError, ErrorCode } from '../services/errors';
import { asyncHandler } from '../utils/asyncHandler';

/** Verifies the httpOnly JWT cookie and attaches the current, freshly-loaded `User` to `req.user`. */
export const authenticate = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  if (!token) throw new ApiError(ErrorCode.UNAUTHENTICATED, 'Not authenticated.');

  let userId: string;
  try {
    userId = verifyToken(token).sub;
  } catch {
    throw new ApiError(ErrorCode.UNAUTHENTICATED, 'Session expired. Please log in again.');
  }

  const user = await getUserById(userId);
  if (!user || !user.isActive) {
    throw new ApiError(ErrorCode.UNAUTHENTICATED, 'Session expired. Please log in again.');
  }

  req.user = user;
  next();
});
