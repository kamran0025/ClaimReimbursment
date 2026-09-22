import { ClaimStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { getClaimScopeFilter, assertClaimInScope, type ScopeUser } from './claimScope';
import { ApiError, ErrorCode } from './errors';
import { serializeClaim, serializeClaimItem, serializeMessage, serializeReceipt } from './serializers';
import { resolvePage, type PageParams } from '../utils/paginate';
import type { Paginated } from '../types/api';

const claimRelationsInclude = {
  claimant: true,
  assignedApprover: true,
  decidedBy: true,
} satisfies Prisma.ClaimInclude;

export interface ClaimFilters {
  status?: ClaimStatus | ClaimStatus[];
  claimantId?: string;
  assignedApproverId?: string;
  decidedById?: string;
  dateFrom?: string;
  dateTo?: string;
  amountMin?: number;
  amountMax?: number;
  search?: string;
}

function buildFilterWhere(filters: ClaimFilters): Prisma.ClaimWhereInput {
  const where: Prisma.ClaimWhereInput = {};
  if (filters.status) {
    where.status = Array.isArray(filters.status) ? { in: filters.status } : filters.status;
  }
  if (filters.claimantId) where.claimantId = filters.claimantId;
  if (filters.assignedApproverId) where.assignedApproverId = filters.assignedApproverId;
  if (filters.decidedById) where.decidedById = filters.decidedById;
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.createdAt.lte = new Date(`${filters.dateTo}T23:59:59.999Z`);
  }
  if (filters.amountMin != null || filters.amountMax != null) {
    where.total = {};
    if (filters.amountMin != null) where.total.gte = filters.amountMin;
    if (filters.amountMax != null) where.total.lte = filters.amountMax;
  }
  if (filters.search?.trim()) {
    where.title = { contains: filters.search.trim(), mode: 'insensitive' };
  }
  return where;
}

export async function listClaims(user: ScopeUser, filters: ClaimFilters, page: PageParams): Promise<Paginated<ReturnType<typeof serializeClaim>>> {
  const where: Prisma.ClaimWhereInput = { AND: [getClaimScopeFilter(user), buildFilterWhere(filters)] };
  const { page: p, pageSize, skip, take } = resolvePage(page);

  const [total, claims] = await Promise.all([
    prisma.claim.count({ where }),
    prisma.claim.findMany({ where, include: claimRelationsInclude, orderBy: { createdAt: 'desc' }, skip, take }),
  ]);

  return { items: claims.map(serializeClaim), total, page: p, pageSize };
}

async function loadClaimOrThrow(claimId: string) {
  const claim = await prisma.claim.findUnique({ where: { id: claimId }, include: claimRelationsInclude });
  if (!claim) throw new ApiError(ErrorCode.CLAIM_NOT_FOUND, 'Claim not found.');
  return claim;
}

export async function getClaimDetail(user: ScopeUser, claimId: string) {
  const claim = await loadClaimOrThrow(claimId);
  assertClaimInScope(user, claim);
  return buildClaimDetail(claim);
}

/** Shared by every mutation's return value — always reload+reserialize post-mutation rather than hand-patching the in-memory object. */
export async function buildClaimDetail(claim: Awaited<ReturnType<typeof loadClaimOrThrow>>) {
  const [items, receipts, messages] = await Promise.all([
    prisma.claimItem.findMany({ where: { claimId: claim.id }, orderBy: { expenseDate: 'asc' } }),
    prisma.receipt.findMany({ where: { claimId: claim.id }, orderBy: { createdAt: 'asc' } }),
    prisma.claimMessage.findMany({
      where: { claimId: claim.id },
      include: { sender: true, attachedReceipt: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  return {
    ...serializeClaim(claim),
    items: items.map(serializeClaimItem),
    receipts: receipts.map(serializeReceipt),
    messages: messages.map(serializeMessage),
  };
}

export async function getClaimDetailById(claimId: string) {
  const claim = await loadClaimOrThrow(claimId);
  return buildClaimDetail(claim);
}

/** Internal helper other services use to fetch+scope-check a claim before mutating it. */
export async function loadOwnedOrScopedClaim(user: ScopeUser, claimId: string) {
  const claim = await loadClaimOrThrow(claimId);
  assertClaimInScope(user, claim);
  return claim;
}

export async function loadClaimForMutation(claimId: string) {
  return loadClaimOrThrow(claimId);
}
