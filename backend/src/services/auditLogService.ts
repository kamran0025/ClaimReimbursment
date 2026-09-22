import { Prisma, type AuditAction, type ClaimStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { serializeAudit } from './serializers';
import { resolvePage, type PageParams } from '../utils/paginate';
import type { Paginated } from '../types/api';

export interface RecordAuditInput {
  claimId: string;
  actorId: string | null;
  action: AuditAction;
  oldStatus: ClaimStatus | null;
  newStatus: ClaimStatus | null;
  metadata?: Record<string, unknown>;
}

/** Writes one audit row. Always called inside the same transaction as the state change it records. */
export async function recordAudit(tx: Prisma.TransactionClient, input: RecordAuditInput): Promise<void> {
  await tx.auditLog.create({
    data: {
      claimId: input.claimId,
      actorId: input.actorId,
      action: input.action,
      oldStatus: input.oldStatus,
      newStatus: input.newStatus,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}

export async function listAuditForClaim(claimId: string) {
  const logs = await prisma.auditLog.findMany({
    where: { claimId },
    include: { actor: true },
    orderBy: { createdAt: 'asc' },
  });
  return logs.map(serializeAudit);
}

export interface AuditFilters {
  claimId?: string;
  action?: string;
}

export async function listAllAudit(filters: AuditFilters, page: PageParams): Promise<Paginated<ReturnType<typeof serializeAudit>>> {
  const where: Prisma.AuditLogWhereInput = {};
  if (filters.claimId) where.claimId = filters.claimId;
  if (filters.action) where.action = filters.action as AuditAction;

  const { page: p, pageSize, skip, take } = resolvePage(page);
  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, include: { actor: true }, orderBy: { createdAt: 'desc' }, skip, take }),
  ]);
  return { items: logs.map(serializeAudit), total, page: p, pageSize };
}
