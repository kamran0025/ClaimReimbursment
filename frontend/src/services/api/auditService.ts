// Audit trail reads — scoped exactly like claim reads (enforced server-side).
import type { AuditLog } from '@/types/models';
import type { PageParams, Paginated } from '@/types/api';
import { apiGet } from './httpClient';

export async function listAuditForClaim(claimId: string): Promise<AuditLog[]> {
  return apiGet<AuditLog[]>(`/audit/claims/${claimId}`);
}

export interface AuditFilters {
  claimId?: string;
  action?: string;
}

export async function listAllAudit(filters?: AuditFilters, page?: PageParams): Promise<Paginated<AuditLog>> {
  return apiGet<Paginated<AuditLog>>('/audit', {
    claimId: filters?.claimId,
    action: filters?.action,
    page: page?.page,
    pageSize: page?.pageSize,
  });
}
