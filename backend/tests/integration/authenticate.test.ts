// Focused coverage for the `authenticate` middleware (src/middleware/authenticate.ts).
// rbac.test.ts already checks the "no cookie" case as part of the RBAC matrix;
// this file drills into every other branch (bad token, expired token, deleted
// user, deactivated user, happy path) using the real app + a real test DB,
// matching this suite's existing integration-test style (plan-backend.md §9
// rules out mocking Prisma/DB access).
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { migrateTestDb, resetTestDb, seedTestUsers, testPrisma, type SeededUsers } from '../helpers/testDb';
import { agentAs, anonAgent, app } from '../helpers/testApp';
import { AUTH_COOKIE_NAME } from '../../src/lib/cookies';
import { env } from '../../src/lib/env';
import request from 'supertest';

let users: SeededUsers;

function withCookie(token: string) {
  return request(app).get('/auth/me').set('Cookie', `${AUTH_COOKIE_NAME}=${token}`);
}

beforeAll(() => {
  migrateTestDb();
});

beforeEach(async () => {
  await resetTestDb();
  users = await seedTestUsers();
});

describe('authenticate middleware', () => {
  it('rejects a request with no auth cookie at all', async () => {
    const res = await anonAgent().get('/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
    expect(res.body.error.message).toBe('Not authenticated.');
  });

  it('rejects a malformed/garbage token', async () => {
    const res = await withCookie('not-a-real-jwt');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
    expect(res.body.error.message).toBe('Session expired. Please log in again.');
  });

  it('rejects a token signed with the wrong secret', async () => {
    const forged = jwt.sign({ sub: users.claimantA.id }, 'not-the-real-secret', { expiresIn: '1d' });
    const res = await withCookie(forged);
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Session expired. Please log in again.');
  });

  it('rejects an expired token', async () => {
    const expired = jwt.sign({ sub: users.claimantA.id }, env.jwtSecret, { expiresIn: -10 });
    const res = await withCookie(expired);
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Session expired. Please log in again.');
  });

  it('rejects a valid token whose user no longer exists', async () => {
    const token = jwt.sign({ sub: 'does-not-exist' }, env.jwtSecret, { expiresIn: '1d' });
    const res = await withCookie(token);
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Session expired. Please log in again.');
  });

  it('rejects a valid token for a deactivated user', async () => {
    const deactivated = await testPrisma.user.create({
      data: {
        name: 'Deactivated',
        email: 'test-deactivated@example.com',
        role: 'CLAIMANT',
        passwordHash: 'irrelevant',
        isActive: false,
      },
    });
    const token = jwt.sign({ sub: deactivated.id }, env.jwtSecret, { expiresIn: '1d' });
    const res = await withCookie(token);
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Session expired. Please log in again.');
  });

  it('accepts a valid token for an active user and attaches the fresh user to the request', async () => {
    const res = await agentAs(users.claimantA.id).get('/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(users.claimantA.id);
    expect(res.body.data.email).toBe('test-claimantA@example.com');
    expect(res.body.data.passwordHash).toBeUndefined();
  });
});
