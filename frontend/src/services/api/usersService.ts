// Employee directory (Finance-only) + active-approver lookup (any
// authenticated user — the claimant needs this list to populate the
// "assign an approver" dropdown at submit time).
import type { User } from '@/types/models';
import { apiGet } from './httpClient';

export async function listEmployees(): Promise<User[]> {
  return apiGet<User[]>('/users/employees');
}

/** GET /users/approvers — powers the assignment dropdown. */
export async function listActiveApprovers(): Promise<User[]> {
  return apiGet<User[]>('/users/approvers');
}
