// Central claim state-machine guards (plan-backend.md §5/§6). Every service
// method that changes `claim.status` consults this module instead of setting
// the field ad hoc. Ported 1:1 from frontend/src/services/api/stateMachine.ts
// so both sides agree on exactly which transitions are legal.
import { ClaimStatus, Role, type Claim, type Prisma } from '@prisma/client';
import { ApiError, ErrorCode } from './errors';

/** Claimant may edit title/items only while the claim is in one of these states. */
export function isEditableStatus(status: ClaimStatus): boolean {
  return status === ClaimStatus.DRAFT || status === ClaimStatus.REJECTED;
}

export function assertEditable(claim: Pick<Claim, 'status'>): void {
  if (!isEditableStatus(claim.status)) {
    throw new ApiError(
      ErrorCode.CLAIM_NOT_EDITABLE,
      `Claim cannot be edited while in status ${claim.status}. Only DRAFT or REJECTED claims are editable.`,
    );
  }
}

/** "Before a decision is made" per plan-backend.md §5 — nobody has decided the current cycle yet. */
export function isCancellable(claim: Pick<Claim, 'status' | 'decidedById'>): boolean {
  if (claim.status === ClaimStatus.DRAFT) return true;
  if (claim.status === ClaimStatus.PENDING_APPROVAL) return claim.decidedById == null;
  return false;
}

export function assertCancellable(claim: Pick<Claim, 'status' | 'decidedById'>): void {
  if (!isCancellable(claim)) {
    throw new ApiError(
      ErrorCode.CLAIM_NOT_CANCELLABLE,
      `Claim cannot be cancelled once a decision is underway (status: ${claim.status}).`,
    );
  }
}

export function assertSubmittable(claim: Pick<Claim, 'status'>): void {
  if (claim.status !== ClaimStatus.DRAFT && claim.status !== ClaimStatus.REJECTED) {
    throw new ApiError(
      ErrorCode.CLAIM_INVALID_TRANSITION,
      `Claim in status ${claim.status} cannot be submitted. Only DRAFT or REJECTED claims can be (re)submitted.`,
    );
  }
}

/**
 * The claim has been submitted and no final decision has been made yet — the
 * decision-maker and claimant may still freely exchange messages, and the
 * decision-maker may approve/reject/request-info, in any of these sub-states.
 * `INFO_REQUESTED` vs `PENDING_*` is just a record of who sent the most
 * recent info-request-type message, not a strict turn lock.
 */
export function isInReview(status: ClaimStatus): boolean {
  return (
    status === ClaimStatus.PENDING_APPROVAL ||
    status === ClaimStatus.PENDING_FINANCE_APPROVAL ||
    status === ClaimStatus.INFO_REQUESTED
  );
}

/** Claims with a total strictly above `threshold` need Finance sign-off after the approver's. */
export function requiresFinanceApproval(total: Prisma.Decimal | number, threshold: number): boolean {
  return Number(total) > threshold;
}

/**
 * The assigned approver has already signed off and the claim now waits on
 * Finance. Covers an info request raised by Finance at this stage too —
 * `approverApprovedById` survives the INFO_REQUESTED round trip and is only
 * cleared on (re)submit.
 */
export function isAtFinanceStage(claim: Pick<Claim, 'status' | 'approverApprovedById'>): boolean {
  if (claim.status === ClaimStatus.PENDING_FINANCE_APPROVAL) return true;
  return claim.status === ClaimStatus.INFO_REQUESTED && claim.approverApprovedById != null;
}

/**
 * Who may approve / reject / request-info right now (plan-backend.md §6):
 * while the claim is with its approver, the current `assignedApproverId` OR
 * any Finance user; once escalated to the Finance stage, Finance only.
 */
export function assertDecidable(
  claim: Pick<Claim, 'status' | 'assignedApproverId' | 'approverApprovedById'>,
  user: { id: string; role: Role },
): void {
  if (!isInReview(claim.status)) {
    throw new ApiError(ErrorCode.CLAIM_NOT_PENDING_APPROVAL, `Claim is not awaiting a decision (status: ${claim.status}).`);
  }
  if (user.role === Role.FINANCE) return;
  if (isAtFinanceStage(claim)) {
    throw new ApiError(ErrorCode.FINANCE_APPROVAL_REQUIRED, 'This claim is awaiting final approval from Finance.');
  }
  if (claim.assignedApproverId !== user.id) {
    throw new ApiError(ErrorCode.CLAIM_NOT_ASSIGNED, 'This claim is not assigned to you.');
  }
}

/** Only the claimant, and only while the claim is still in review, may post a response/message. */
export function assertRespondable(claim: Pick<Claim, 'status' | 'claimantId'>, user: { id: string }): void {
  if (!isInReview(claim.status)) {
    throw new ApiError(ErrorCode.CLAIM_NOT_INFO_REQUESTED, `Claim is not awaiting a response (status: ${claim.status}).`);
  }
  if (claim.claimantId !== user.id) {
    throw new ApiError(ErrorCode.CLAIM_NOT_OWNED, 'You can only respond on your own claims.');
  }
}
