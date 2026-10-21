// Per-role dashboard aggregates — plan-backend.md §7 (`GET /dashboards/*`).
// Ported from frontend/src/services/api/dashboardService.ts; the approver
// dashboard reads directly off `Claim.assignedApproverId`/`decidedById`
// (v2 — no separate approval-steps table to join through).
import { ClaimStatus, Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { getClaimScopeFilter } from './claimScope';
import { isAtFinanceStage, isInReview } from './claimStateMachine';
import { serializeClaim } from './serializers';

export type StatusCounts = Record<ClaimStatus, number>;

function emptyStatusCounts(): StatusCounts {
  return Object.values(ClaimStatus).reduce((acc, s) => {
    acc[s] = 0;
    return acc;
  }, {} as StatusCounts);
}

function countByStatus(claims: { status: ClaimStatus }[]): StatusCounts {
  const counts = emptyStatusCounts();
  for (const c of claims) counts[c.status] += 1;
  return counts;
}

const claimRelationsInclude = { claimant: true, assignedApprover: true, decidedBy: true } as const;

export async function getClaimantDashboard(userId: string) {
  const mine = await prisma.claim.findMany({ where: getClaimScopeFilter({ id: userId, role: Role.CLAIMANT }) });
  const recentClaims = await prisma.claim.findMany({
    where: getClaimScopeFilter({ id: userId, role: Role.CLAIMANT }),
    include: claimRelationsInclude,
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  return { counts: countByStatus(mine), recentClaims: recentClaims.map(serializeClaim) };
}

export async function getApproverDashboard(userId: string) {
  const assigned = await prisma.claim.findMany({ where: { assignedApproverId: userId }, include: claimRelationsInclude });

  // Claims escalated to Finance are no longer the approver's to act on.
  const actionable = assigned.filter((c) => isInReview(c.status) && !isAtFinanceStage(c));
  const infoRequested = actionable.filter((c) => c.status === ClaimStatus.INFO_REQUESTED);
  const todayStr = new Date().toDateString();
  // An approver's sign-off counts whether it closed the claim or escalated it to Finance.
  const approvedToday = assigned.filter(
    (c) =>
      (c.status === ClaimStatus.APPROVED && c.decidedById === userId && c.decidedAt?.toDateString() === todayStr) ||
      (c.approverApprovedById === userId && c.approverApprovedAt?.toDateString() === todayStr),
  ).length;
  const awaitingFinanceCount = assigned.filter((c) => c.status === ClaimStatus.PENDING_FINANCE_APPROVAL).length;
  const rejectedCount = assigned.filter((c) => c.status === ClaimStatus.REJECTED && c.decidedById === userId).length;
  const totalPendingAmount = actionable.reduce((sum, c) => sum + Number(c.total), 0);
  const pendingClaims = [...actionable].sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime()).map(serializeClaim);

  return {
    pendingCount: actionable.length,
    infoRequestedCount: infoRequested.length,
    approvedToday,
    rejectedCount,
    awaitingFinanceCount,
    totalPendingAmount,
    pendingClaims,
  };
}

export async function getFinanceDashboard() {
  const all = await prisma.claim.findMany({ where: getClaimScopeFilter({ id: '', role: Role.FINANCE }) });
  const totalApprovedAmount = all.filter((c) => c.status === ClaimStatus.APPROVED).reduce((sum, c) => sum + Number(c.total), 0);
  return { counts: countByStatus(all), totalApprovedAmount, totalClaims: all.length };
}
