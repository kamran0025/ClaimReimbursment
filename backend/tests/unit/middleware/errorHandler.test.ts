// Unit tests for src/middleware/errorHandler.ts — each error type maps to the
// documented `{ success: false, error: { code, message, details? } }` shape.
import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import multer from 'multer';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { errorHandler, notFoundHandler } from '../../../src/middleware/errorHandler';
import { ApiError, ErrorCode } from '../../../src/services/errors';
import { logger } from '../../../src/lib/logger';

function appThrowing(err: unknown) {
  const app = express();
  app.get('/', () => {
    throw err;
  });
  app.get('/locals', (_req, _res, next) => next(err));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

afterEach(() => vi.restoreAllMocks());

describe('errorHandler', () => {
  it('returns an ApiError with its own status, code, message and details', async () => {
    const res = await request(appThrowing(new ApiError(ErrorCode.CLAIM_NOT_FOUND, 'Claim not found.', { id: 'c1' }))).get('/');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, error: { code: 'CLAIM_NOT_FOUND', message: 'Claim not found.', details: { id: 'c1' } } });
  });

  it('records the ApiError code for the request logger', async () => {
    const app = express();
    let errorCode: unknown;
    app.use((_req, res, next) => {
      res.on('finish', () => (errorCode = res.locals.errorCode));
      next();
    });
    app.get('/', () => {
      throw new ApiError(ErrorCode.FORBIDDEN_ROLE, 'No.');
    });
    app.use(errorHandler);
    await request(app).get('/');
    expect(errorCode).toBe('FORBIDDEN_ROLE');
  });

  it('turns a ZodError into a 400 VALIDATION_ERROR with issues', async () => {
    const zodError = z.object({ title: z.string() }).safeParse({}).error;
    const res = await request(appThrowing(zodError)).get('/');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toBe('Invalid request.');
    expect(res.body.error.details.issues[0].path).toBe('title');
  });

  it('turns a MulterError into a 400 VALIDATION_ERROR', async () => {
    const res = await request(appThrowing(new multer.MulterError('LIMIT_FILE_SIZE'))).get('/');
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({ code: 'VALIDATION_ERROR', message: 'File too large' });
  });

  it('turns a Prisma "record not found" (P2025) into a 404', async () => {
    const err = new Prisma.PrismaClientKnownRequestError('Record not found', { code: 'P2025', clientVersion: 'test' });
    const res = await request(appThrowing(err)).get('/');
    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Resource not found.' });
  });

  it('turns any other error into a 500 and logs it', async () => {
    const logged = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const res = await request(appThrowing(new Error('db exploded'))).get('/locals?x=1');
    expect(res.status).toBe(500);
    expect(res.body.error).toEqual({ code: 'INTERNAL_ERROR', message: 'db exploded' });
    expect(logged).toHaveBeenCalledWith('GET /locals - db exploded');
  });

  it('uses a generic message when a non-Error value is thrown', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => {});
    const res = await request(appThrowing('just a string')).get('/');
    expect(res.status).toBe(500);
    expect(res.body.error.message).toBe('Something went wrong. Please try again.');
  });
});

describe('notFoundHandler', () => {
  it('returns 404 NOT_FOUND naming the unknown route', async () => {
    const res = await request(appThrowing(null)).post('/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, error: { code: 'NOT_FOUND', message: 'No route: POST /does-not-exist' } });
  });
});
