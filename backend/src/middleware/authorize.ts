import type { NextFunction, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { ApiError, ErrorCode } from '../services/errors';

/** Route-level role gate. Ownership/assignment checks still happen in the service layer. */
export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new ApiError(ErrorCode.UNAUTHENTICATED, 'Not authenticated.'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new ApiError(ErrorCode.FORBIDDEN_ROLE, `This action requires one of: ${roles.join(', ')}.`));
      return;
    }
    next();
  };
}

/** Approve/reject/request-info may be performed by an approver or Finance. */
export const authorizeDecisionMaker = authorize(Role.APPROVER, Role.FINANCE);
