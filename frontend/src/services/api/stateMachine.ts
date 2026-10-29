// Pure claim-status predicates used for UI gating (disabling buttons,
// choosing which panel to show). The actual state-machine *enforcement*
// (throwing on an illegal transition) now lives entirely server-side —
// backend/src/services/claimStateMachine.ts is the real guard; these are
// UX conveniences only, same as the plan always intended for anything on
// the frontend (plan-backend.md §6: "must never be relied upon").
import { ClaimStatus, Role } from '@/types/enums';

/** Claimant may edit title/items only while the claim is in one of these states (PENDING_APPROVAL: until the approver acts). */
export function isEditableStatus(status: ClaimStatus): boolean {
  return status === ClaimStatus.DRAFT || status === ClaimStatus.REJECTED || status === ClaimStatus.PENDING_APPROVAL;
}

/**
 * The claim has been submitted and no final decision has been made yet — the
 * decision-maker and claimant may still freely exchange messages, and the
 * decision-maker may approve/reject/request-info, in any of these sub-states.
 */
export function isInReview(status: ClaimStatus): boolean {
  return (
    status === ClaimStatus.PENDING_APPROVAL ||
    status === ClaimStatus.PENDING_FINANCE_APPROVAL ||
    status === ClaimStatus.INFO_REQUESTED
  );
}

/**
 * The approver has signed off a high-value claim and only Finance may decide
 * it now — including while Finance's own info request is open.
 */
export function isAtFinanceStage(claim: { status: ClaimStatus; approverApprovedById: string | null }): boolean {
  if (claim.status === ClaimStatus.PENDING_FINANCE_APPROVAL) return true;
  return claim.status === ClaimStatus.INFO_REQUESTED && claim.approverApprovedById != null;
}

/** Whether `user` may approve / reject / request-info on `claim` right now. */
export function canDecideClaim(
  claim: { status: ClaimStatus; assignedApproverId: string | null; approverApprovedById: string | null },
  user: { id: string; role: Role },
): boolean {
  if (!isInReview(claim.status)) return false;
  if (user.role === Role.FINANCE) return true;
  return !isAtFinanceStage(claim) && claim.assignedApproverId === user.id;
}

/** Mirrors backend `isReassignable`: still with its approver — undecided and not yet signed off to Finance. */
export function isReassignable(claim: { status: ClaimStatus; approverApprovedById: string | null }): boolean {
  return (
    (claim.status === ClaimStatus.PENDING_APPROVAL || claim.status === ClaimStatus.INFO_REQUESTED) &&
    claim.approverApprovedById == null
  );
}

/** Whether `user` may hand `claim` to a different approver: its assigned approver, or Finance. */
export function canReassignClaim(
  claim: { status: ClaimStatus; assignedApproverId: string | null; approverApprovedById: string | null },
  user: { id: string; role: Role },
): boolean {
  if (!isReassignable(claim)) return false;
  return user.role === Role.FINANCE || claim.assignedApproverId === user.id;
}
