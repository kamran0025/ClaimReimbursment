// Pure claim-status predicates used for UI gating (disabling buttons,
// choosing which panel to show). The actual state-machine *enforcement*
// (throwing on an illegal transition) now lives entirely server-side —
// backend/src/services/claimStateMachine.ts is the real guard; these are
// UX conveniences only, same as the plan always intended for anything on
// the frontend (plan-backend.md §6: "must never be relied upon").
import { ClaimStatus } from '@/types/enums';

/** Claimant may edit title/items only while the claim is in one of these states. */
export function isEditableStatus(status: ClaimStatus): boolean {
  return status === ClaimStatus.DRAFT || status === ClaimStatus.REJECTED;
}

/**
 * The claim has been submitted and no decision has been made yet — the
 * decision-maker and claimant may still freely exchange messages, and the
 * decision-maker may approve/reject/request-info, in either of these two
 * sub-states.
 */
export function isInReview(status: ClaimStatus): boolean {
  return status === ClaimStatus.PENDING_APPROVAL || status === ClaimStatus.INFO_REQUESTED;
}
