import request from 'supertest';
import { createApp } from '../../src/app';
import { signToken } from '../../src/services/authService';
import { AUTH_COOKIE_NAME } from '../../src/lib/cookies';

export const app = createApp();

/** Returns a supertest agent pre-authenticated as `userId` (signs the same JWT `/auth/login` would issue). */
export function agentAs(userId: string) {
  const token = signToken(userId);
  const agent = request.agent(app);
  const originalGet = agent.get.bind(agent);
  // supertest's `agent()` only persists cookies set BY the server in a prior
  // response; we want to start already-authenticated, so seed the cookie jar
  // by attaching the header on every request instead.
  return {
    get: (url: string) => originalGet(url).set('Cookie', `${AUTH_COOKIE_NAME}=${token}`),
    post: (url: string) => agent.post(url).set('Cookie', `${AUTH_COOKIE_NAME}=${token}`),
    patch: (url: string) => agent.patch(url).set('Cookie', `${AUTH_COOKIE_NAME}=${token}`),
    delete: (url: string) => agent.delete(url).set('Cookie', `${AUTH_COOKIE_NAME}=${token}`),
  };
}

export function anonAgent() {
  return request(app);
}
