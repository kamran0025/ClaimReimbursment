// Unit tests for src/middleware/requestLogger.ts — one short log line per
// request, at a level matching the status, with masked/truncated payloads.
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import express from 'express';
import request from 'supertest';
import { requestLogger } from '../../../src/middleware/requestLogger';
import { errorHandler } from '../../../src/middleware/errorHandler';
import { ApiError, ErrorCode } from '../../../src/services/errors';
import { logger } from '../../../src/lib/logger';

const app = express();
app.use(requestLogger);
app.use(express.json());
app.get('/ok', (_req, res) => res.json({ ok: true }));
app.post('/ok', (_req, res) => res.json({ ok: true }));
app.get('/forbidden', () => {
  throw new ApiError(ErrorCode.FORBIDDEN_ROLE, 'No.');
});
app.get('/boom', () => {
  throw new Error('boom');
});
app.use(errorHandler);

let info: MockInstance;
let warn: MockInstance;
let error: MockInstance;

beforeEach(() => {
  info = vi.spyOn(logger, 'info').mockImplementation(() => {});
  warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  error = vi.spyOn(logger, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

/** The single request line logged at the given level. */
function lineFrom(spy: MockInstance): string {
  expect(spy).toHaveBeenCalledTimes(1);
  return spy.mock.calls[0][0] as string;
}

describe('requestLogger', () => {
  it('logs a successful request as INFO with method, path, status and duration', async () => {
    await request(app).get('/ok');
    expect(lineFrom(info)).toMatch(/^GET \/ok 200 \d+ms$/);
    expect(warn).not.toHaveBeenCalled();
  });

  it('logs a 4xx as WARN, with the error code', async () => {
    await request(app).get('/forbidden');
    expect(lineFrom(warn)).toMatch(/^GET \/forbidden 403 \d+ms FORBIDDEN_ROLE$/);
  });

  it('logs an unknown route as WARN without an error code', async () => {
    await request(app).get('/nope');
    expect(lineFrom(warn)).toMatch(/^GET \/nope 404 \d+ms$/);
  });

  it('logs a 5xx as ERROR', async () => {
    await request(app).get('/boom');
    // errorHandler logs the error message too; the request line is the last one.
    expect(error.mock.calls.at(-1)?.[0]).toMatch(/^GET \/boom 500 \d+ms$/);
  });

  it('shows the query separately from the path', async () => {
    await request(app).get('/ok?status=SUBMITTED&page=2');
    expect(lineFrom(info)).toMatch(/^GET \/ok 200 \d+ms query=\{"status":"SUBMITTED","page":"2"\}$/);
  });

  it('shows the request body', async () => {
    await request(app).post('/ok').send({ title: 'Taxi' });
    expect(lineFrom(info)).toMatch(/ body=\{"title":"Taxi"\}$/);
  });

  it('shows both query and body together', async () => {
    await request(app).post('/ok?draft=true').send({ title: 'Taxi' });
    expect(lineFrom(info)).toMatch(/ query=\{"draft":"true"\} body=\{"title":"Taxi"\}$/);
  });

  it('masks passwords, including nested ones', async () => {
    await request(app).post('/ok').send({ email: 'a@b.com', password: 'secret', nested: { password: 'secret2' } });
    const line = lineFrom(info);
    expect(line).not.toContain('secret');
    expect(line).toContain('body={"email":"a@b.com","password":"***","nested":{"password":"***"}}');
  });

  it('cuts off long payloads at 200 characters', async () => {
    await request(app).post('/ok').send({ title: 'x'.repeat(500) });
    const body = lineFrom(info).split(' body=')[1];
    expect(body).toHaveLength(200 + '...'.length);
    expect(body.endsWith('...')).toBe(true);
  });

  it('omits empty query and body', async () => {
    await request(app).post('/ok').send({});
    expect(lineFrom(info)).toMatch(/^POST \/ok 200 \d+ms$/);
  });
});
