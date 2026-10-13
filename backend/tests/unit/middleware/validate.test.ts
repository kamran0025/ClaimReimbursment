// Unit tests for src/middleware/validate.ts — body/query parsing via zod.
import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { validateBody, validateQuery } from '../../../src/middleware/validate';
import { errorHandler } from '../../../src/middleware/errorHandler';

const bodySchema = z.object({ title: z.string().min(1), amount: z.coerce.number().positive() });
const querySchema = z.object({ page: z.coerce.number().int().default(1) });

const app = express();
app.use(express.json());
app.post('/body', validateBody(bodySchema), (req, res) => res.json({ body: req.body }));
app.get('/query', validateQuery(querySchema), (req, res) => res.json({ query: req.query }));
app.use(errorHandler);

describe('validateBody', () => {
  it('passes a valid body through, replaced by the parsed output', async () => {
    const res = await request(app).post('/body').send({ title: 'Taxi', amount: '12.5', extra: 'dropped' });
    expect(res.status).toBe(200);
    expect(res.body.body).toEqual({ title: 'Taxi', amount: 12.5 });
  });

  it('rejects an invalid body with VALIDATION_ERROR and per-field issues', async () => {
    const res = await request(app).post('/body').send({ title: '', amount: -1 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const paths = res.body.error.details.issues.map((i: { path: string }) => i.path);
    expect(paths).toEqual(expect.arrayContaining(['title', 'amount']));
  });

  it('rejects a missing body', async () => {
    const res = await request(app).post('/body');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('validateQuery', () => {
  it('coerces and applies defaults to the query', async () => {
    expect((await request(app).get('/query?page=3')).body.query).toEqual({ page: 3 });
    expect((await request(app).get('/query')).body.query).toEqual({ page: 1 });
  });

  it('rejects an invalid query', async () => {
    const res = await request(app).get('/query?page=abc');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
