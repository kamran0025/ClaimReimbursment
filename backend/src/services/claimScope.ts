// The single security boundary (plan-backend.md §6). Every list/detail query
// applies this as a Prisma `WHERE` clause — never fetch-then-filter-in-JS.
// Ported from frontend/src/services/api/scope.ts (in-memory predicate there,
// Prisma `where` clause here — same decision, same place).
import { ClaimStatus, Prisma, Role, type Claim } from '@prisma/client';
import { ApiError, ErrorCode } from './errors';

export interface ScopeUser {
  id: string;
  role: Role;
}

/**
 * DRAFT claims are unsubmitted work-in-progress that only the owning
 * claimant may see — Finance never gets visibility into them, same as an
 * approver never does (a draft has no `assignedApproverId` yet).
 */
export function getClaimScopeFilter(user: ScopeUser): Prisma.ClaimWhereInput {
  if (user.role === Role.FINANCE) return { status: { not: ClaimStatus.DRAFT } };
  if (user.role === Role.CLAIMANT) return { claimantId: user.id };
  if (user.role === Role.APPROVER) return { assignedApproverId: user.id };
  return { id: '__none__' };
}

export function claimInScope(user: ScopeUser, claim: Pick<Claim, 'status' | 'claimantId' | 'assignedApproverId'>): boolean {
  if (user.role === Role.FINANCE) return claim.status !== ClaimStatus.DRAFT;
  if (user.role === Role.CLAIMANT) return claim.claimantId === user.id;
  if (user.role === Role.APPROVER) return claim.assignedApproverId === user.id;
  return false;
}

/** Throws the correct 403 code (spec §6) if `user` may not view `claim`. */
export function assertClaimInScope(user: ScopeUser, claim: Pick<Claim, 'status' | 'claimantId' | 'assignedApproverId'>): void {
  if (claimInScope(user, claim)) return;
  if (user.role === Role.APPROVER) {
    throw new ApiError(ErrorCode.CLAIM_NOT_ASSIGNED, 'This claim is not assigned to you.');
  }
  throw new ApiError(ErrorCode.CLAIM_NOT_OWNED, 'You do not have access to this claim.');
}

export function assertOwner(user: { id: string }, claim: Pick<Claim, 'claimantId'>): void {
  if (claim.claimantId !== user.id) {
    throw new ApiError(ErrorCode.CLAIM_NOT_OWNED, 'You can only modify your own claims.');
  }
}
