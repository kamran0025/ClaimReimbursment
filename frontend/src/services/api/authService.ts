// Real backend auth. The httpOnly `access_token` cookie set by `/auth/login`
// rides along automatically on every subsequent request (`credentials:
// 'include'`, handled in httpClient.ts) — there is no client-side session
// state to manage here, unlike the mock this replaced.
import type { User } from '@/types/models';
import { Role } from '@/types/enums';
import { apiGet, apiPost } from './httpClient';

export async function login(email: string, password: string): Promise<User> {
  return apiPost<User>('/auth/login', { email, password });
}

export async function logout(): Promise<void> {
  await apiPost<null>('/auth/logout');
}

export async function me(): Promise<User> {
  return apiGet<User>('/auth/me');
}

/**
 * Demo-only: every seeded login shares this password (see
 * `backend/prisma/seed.ts`). Re-exported here (not from a data module) so
 * pages never reach past the `services/api` boundary.
 */
export const DEMO_PASSWORD = 'password123';

/**
 * Powers the "pick a seeded user" convenience login screen. Hardcoded
 * rather than fetched — the real backend deliberately has no
 * unauthenticated "list every user" endpoint (that would be a real
 * information-disclosure hole, not just a POC shortcut), so this mirrors
 * `backend/prisma/seed.ts`'s fixed identities instead.
 */
export async function listSeededLogins(): Promise<Pick<User, 'id' | 'name' | 'email' | 'role'>[]> {
  return SEEDED_LOGINS;
}

const SEEDED_LOGINS: Pick<User, 'id' | 'name' | 'email' | 'role'>[] = [
  { id: 'u_finance1', name: 'Neha Kulkarni', email: 'finance@example.com', role: Role.FINANCE },
  { id: 'u_approver1', name: 'Arjun Mehta', email: 'approver1@example.com', role: Role.APPROVER },
  { id: 'u_approver2', name: 'Kavita Rao', email: 'approver2@example.com', role: Role.APPROVER },
  { id: 'u_approver3', name: 'Sanjay Iyer', email: 'approver3@example.com', role: Role.APPROVER },
  { id: 'u_employee1', name: 'Rahul Sharma', email: 'employee1@example.com', role: Role.CLAIMANT },
  { id: 'u_employee2', name: 'Ananya Gupta', email: 'employee2@example.com', role: Role.CLAIMANT },
  { id: 'u_employee3', name: 'Vikram Singh', email: 'employee3@example.com', role: Role.CLAIMANT },
];
