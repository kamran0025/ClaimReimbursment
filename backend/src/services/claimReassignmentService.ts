// Approver delegation — moving a claim that is still with its approver to a
// different approver. Allowed for the claim's current assigned approver (an
// approver who is away hands their queue to a colleague) and for Finance (who
// may move any approver's claim). The new approver inherits the claim's full
// history for free: messages, receipts and the audit trail are all scoped by
// `assignedApproverId`, so the previous approver loses access at the same time.
//
// The claimant is told only that their approver changed — a sender-less
// APPROVER_CHANGED message with fixed wording. Who moved it, to whom and why
// lives in the CLAIM_REASSIGNED audit row, which is hidden from claimants
// (see auditLogService.listAuditForClaim).
import { ClaimMessageType, ClaimStatus, Role, type Claim, type Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError, ErrorCode } from './errors';
import { assertReassignable } from './claimStateMachine';
import { recordAudit } from './auditLogService';
import { startReviewClock } from './approvalReminderService';
import { buildClaimDetail, loadClaimForMutation } from './claimQueryService';
import type { ScopeUser } from './claimScope';
import type { BulkReassignClaimsInput, ReassignClaimInput } from '../validation/claimValidation';

export const APPROVER_CHANGED_NOTICE = 'The approver for this claim has been changed.';

// Bulk handovers write a few rows per claim; give large queues more than Prisma's 5s default.
const BULK_TX_TIMEOUT_MS = 30_000;

async function assertActiveApproverTarget(tx: Prisma.TransactionClient, toApproverId: string): Promise<void> {
  const target = await tx.user.findUnique({ where: { id: toApproverId }, select: { role: true, isActive: true } });
  if (!target || target.role !== Role.APPROVER || !target.isActive) {
    throw new ApiError(ErrorCode.VALIDATION_ERROR, 'Claims can only be handed to an active approver.', { field: 'toApproverId' });
  }
}

async function reassignOne(
  tx: Prisma.TransactionClient,
  user: ScopeUser,
  claim: Claim,
  input: ReassignClaimInput,
  bulk: boolean,
): Promise<void> {
  assertReassignable(claim, user);
  if (claim.assignedApproverId === input.toApproverId) {
    throw new ApiError(ErrorCode.VALIDATION_ERROR, 'This claim is already assigned to that approver.', { field: 'toApproverId', claimId: claim.id });
  }

  // Conditional on the state we just checked, so a decision (or another
  // reassignment) committed concurrently makes this one fail instead of
  // silently overwriting it.
  const { count } = await tx.claim.updateMany({
    where: { id: claim.id, status: claim.status, assignedApproverId: claim.assignedApproverId, approverApprovedById: null },
    data: { assignedApproverId: input.toApproverId, ...startReviewClock() },
  });
  if (count === 0) {
    throw new ApiError(ErrorCode.CLAIM_NOT_REASSIGNABLE, 'This claim changed while it was being reassigned. Refresh and try again.', { claimId: claim.id });
  }

  await tx.claimMessage.create({
    data: { claimId: claim.id, senderId: null, type: ClaimMessageType.APPROVER_CHANGED, message: APPROVER_CHANGED_NOTICE },
  });
  await recordAudit(tx, {
    claimId: claim.id,
    actorId: user.id,
    action: 'CLAIM_REASSIGNED',
    oldStatus: claim.status,
    newStatus: claim.status,
    metadata: {
      fromApproverId: claim.assignedApproverId,
      toApproverId: input.toApproverId,
      ...(input.reason ? { reason: input.reason } : {}),
      ...(bulk ? { bulk: true } : {}),
    },
  });
}

/** POST /claims/:id/reassign */
export async function reassignClaim(user: ScopeUser, claimId: string, input: ReassignClaimInput) {
  await prisma.$transaction(async (tx) => {
    const claim = await tx.claim.findUnique({ where: { id: claimId } });
    if (!claim) throw new ApiError(ErrorCode.CLAIM_NOT_FOUND, 'Claim not found.');
    assertReassignable(claim, user);
    await assertActiveApproverTarget(tx, input.toApproverId);
    await reassignOne(tx, user, claim, input, false);
  });
  return buildClaimDetail(await loadClaimForMutation(claimId));
}

/**
 * POST /claims/reassign — all-or-nothing. With `claimIds`, every listed claim
 * must pass the same checks as a single reassignment or nothing moves. Without
 * them, every claim still with `fromApproverId` (PENDING_APPROVAL /
 * INFO_REQUESTED, not yet escalated) moves; an approver may only hand over
 * their own queue, Finance must name the approver.
 */
export async function reassignClaimsBulk(user: ScopeUser, input: BulkReassignClaimsInput) {
  return prisma.$transaction(
    async (tx) => {
      let claims: Claim[];
      if (input.claimIds) {
        const ids = [...new Set(input.claimIds)];
        claims = await tx.claim.findMany({ where: { id: { in: ids } }, orderBy: { createdAt: 'asc' } });
        if (claims.length !== ids.length) throw new ApiError(ErrorCode.CLAIM_NOT_FOUND, 'One or more claims were not found.');
        for (const claim of claims) assertReassignable(claim, user);
      } else {
        const fromApproverId = input.fromApproverId ?? (user.role === Role.APPROVER ? user.id : undefined);
        if (!fromApproverId) {
          throw new ApiError(ErrorCode.VALIDATION_ERROR, 'Select the approver whose claims should be handed over.', { field: 'fromApproverId' });
        }
        if (user.role !== Role.FINANCE && fromApproverId !== user.id) {
          throw new ApiError(ErrorCode.CLAIM_NOT_ASSIGNED, 'You can only hand over claims assigned to you.');
        }
        if (fromApproverId === input.toApproverId) {
          throw new ApiError(ErrorCode.VALIDATION_ERROR, 'Choose a different approver to hand the claims to.', { field: 'toApproverId' });
        }
        claims = await tx.claim.findMany({
          where: {
            assignedApproverId: fromApproverId,
            status: { in: [ClaimStatus.PENDING_APPROVAL, ClaimStatus.INFO_REQUESTED] },
            approverApprovedById: null,
          },
          orderBy: { createdAt: 'asc' },
        });
      }

      await assertActiveApproverTarget(tx, input.toApproverId);
      for (const claim of claims) await reassignOne(tx, user, claim, input, true);

      return { reassignedCount: claims.length, claimIds: claims.map((c) => c.id), toApproverId: input.toApproverId };
    },
    { timeout: BULK_TX_TIMEOUT_MS },
  );
}
