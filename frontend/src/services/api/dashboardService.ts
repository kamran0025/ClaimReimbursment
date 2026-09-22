// Per-role dashboard aggregates. The backend derives the caller from the
// auth cookie, so these all take no arguments — same as the mock.
import { ClaimStatus } from '@/types/enums';
import type { Claim } from '@/types/models';
import { apiGet } from './httpClient';

export type StatusCounts = Record<ClaimStatus, number>;

export interface ClaimantDashboard {
  counts: StatusCounts;
  recentClaims: Claim[];
}

export async function getClaimantDashboard(): Promise<ClaimantDashboard> {
  return apiGet<ClaimantDashboard>('/dashboards/claimant');
}

export interface ApproverDashboard {
  pendingCount: number;
  infoRequestedCount: number;
  approvedToday: number;
  rejectedCount: number;
  totalPendingAmount: number;
  pendingClaims: Claim[];
}

export async function getApproverDashboard(): Promise<ApproverDashboard> {
  return apiGet<ApproverDashboard>('/dashboards/approver');
}

export interface FinanceDashboard {
  counts: StatusCounts;
  totalApprovedAmount: number;
  totalClaims: number;
}

export async function getFinanceDashboard(): Promise<FinanceDashboard> {
  return apiGet<FinanceDashboard>('/dashboards/finance');
}
