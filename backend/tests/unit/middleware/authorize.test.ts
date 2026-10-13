// Unit tests for the role gate (src/middleware/authorize.ts) — a tiny express
// app with a fake `req.user`, no database.
import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { Role, type User } from '@prisma/client';
import { authorize, authorizeDecisionMaker } from '../../../src/middleware/authorize';
import { errorHandler } from '../../../src/middleware/errorHandler';

function appWith(gate: express.RequestHandler, role?: Role) {
  const app = express();
  app.use((req, _res, next) => {
    if (role) req.user = { id: 'u1', role } as User;
    next();
  });
  app.get('/', gate, (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  return app;
}

describe('authorize middleware', () => {
  it('lets a user with an allowed role through', async () => {
    const res = await request(appWith(authorize(Role.FINANCE), Role.FINANCE)).get('/');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('rejects a user whose role is not allowed', async () => {
    const res = await request(appWith(authorize(Role.FINANCE), Role.CLAIMANT)).get('/');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
    expect(res.body.error.message).toBe('This action requires one of: FINANCE.');
  });

  it('rejects a request with no logged-in user', async () => {
    const res = await request(appWith(authorize(Role.FINANCE))).get('/');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('accepts any of several allowed roles', async () => {
    const gate = authorize(Role.APPROVER, Role.FINANCE);
    expect((await request(appWith(gate, Role.APPROVER)).get('/')).status).toBe(200);
    expect((await request(appWith(gate, Role.FINANCE)).get('/')).status).toBe(200);
  });

  it('authorizeDecisionMaker allows approvers and finance, not claimants', async () => {
    expect((await request(appWith(authorizeDecisionMaker, Role.APPROVER)).get('/')).status).toBe(200);
    expect((await request(appWith(authorizeDecisionMaker, Role.FINANCE)).get('/')).status).toBe(200);
    expect((await request(appWith(authorizeDecisionMaker, Role.CLAIMANT)).get('/')).status).toBe(403);
  });
});
