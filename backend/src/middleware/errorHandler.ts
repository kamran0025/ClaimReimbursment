import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import multer from 'multer';
import { ZodError } from 'zod';
import { ApiError, ErrorCode } from '../services/errors';
import type { ApiErrorBody } from '../types/api';

export function notFoundHandler(req: Request, res: Response): void {
  const body: ApiErrorBody = { success: false, error: { code: ErrorCode.NOT_FOUND, message: `No route: ${req.method} ${req.path}` } };
  res.status(404).json(body);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    const body: ApiErrorBody = { success: false, error: { code: err.code, message: err.message, details: err.details } };
    res.status(err.status).json(body);
    return;
  }

  if (err instanceof ZodError) {
    const details = { issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) };
    const body: ApiErrorBody = { success: false, error: { code: ErrorCode.VALIDATION_ERROR, message: 'Invalid request.', details } };
    res.status(400).json(body);
    return;
  }

  if (err instanceof multer.MulterError) {
    const body: ApiErrorBody = { success: false, error: { code: ErrorCode.VALIDATION_ERROR, message: err.message } };
    res.status(400).json(body);
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
    const body: ApiErrorBody = { success: false, error: { code: ErrorCode.NOT_FOUND, message: 'Resource not found.' } };
    res.status(404).json(body);
    return;
  }

  // eslint-disable-next-line no-console
  console.error(err);
  const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
  const body: ApiErrorBody = { success: false, error: { code: ErrorCode.INTERNAL_ERROR, message } };
  res.status(500).json(body);
}
