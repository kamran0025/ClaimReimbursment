// Automatic approver assignment on submit/resubmit — claimants no longer pick
// an approver. A new claim goes to the active approver with the fewest open
// claims (PENDING_APPROVAL + INFO_REQUESTED, excluding ones already escalated
// to Finance); ties rotate round-robin by
// handing the claim to whoever was assigned least recently. A resubmitted
// claim stays with its previous approver while that approver is still active.
import { ClaimStatus, Role, type Claim, type Prisma } from '@prisma/client';
import { ApiError, ErrorCode } from './errors';

// Arbitrary app-wide key for the transaction-scoped advisory lock that
// serializes assignment, so two concurrent submissions can't both read the
// same "least loaded" approver.
const ASSIGNMENT_LOCK_KEY = 482_901_337;

const OPEN_STATUSES = [ClaimStatus.PENDING_APPROVAL, ClaimStatus.INFO_REQUESTED];

async function isActiveApprover(tx: Prisma.TransactionClient, userId: string): Promise<boolean> {
  const user = await tx.user.findUnique({ where: { id: userId }, select: { role: true, isActive: true } });
  return !!user && user.role === Role.APPROVER && user.isActive;
}

async function pickLeastLoadedApprover(tx: Prisma.TransactionClient): Promise<string> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ASSIGNMENT_LOCK_KEY})`;

  const approvers = await tx.user.findMany({
    where: { role: Role.APPROVER, isActive: true },
    select: { id: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  if (approvers.length === 0) {
    throw new ApiError(ErrorCode.NO_APPROVER_AVAILABLE, 'No active approver is available to review this claim. Please contact Finance.');
  }
  const ids = approvers.map((a) => a.id);

  const openCounts = await tx.claim.groupBy({
    by: ['assignedApproverId'],
    where: { assignedApproverId: { in: ids }, status: { in: OPEN_STATUSES }, approverApprovedById: null },
    _count: { _all: true },
  });
  const lastAssigned = await tx.claim.groupBy({
    by: ['assignedApproverId'],
    where: { assignedApproverId: { in: ids }, submittedAt: { not: null } },
    _max: { submittedAt: true },
  });

  const loadById = new Map(openCounts.map((r) => [r.assignedApproverId, r._count._all]));
  const lastById = new Map(lastAssigned.map((r) => [r.assignedApproverId, r._max.submittedAt?.getTime() ?? 0]));

  // Stable sort keeps the createdAt order as the final tie-breaker.
  const ranked = [...ids].sort(
    (a, b) => (loadById.get(a) ?? 0) - (loadById.get(b) ?? 0) || (lastById.get(a) ?? 0) - (lastById.get(b) ?? 0),
  );
  return ranked[0];
}

/** Resolves the approver for a (re)submission. Must run inside the submission transaction. */
export async function resolveApprover(
  tx: Prisma.TransactionClient,
  claim: Pick<Claim, 'assignedApproverId'>,
  isResubmit: boolean,
): Promise<string> {
  if (isResubmit && claim.assignedApproverId && (await isActiveApprover(tx, claim.assignedApproverId))) {
    return claim.assignedApproverId;
  }
  return pickLeastLoadedApprover(tx);
}
