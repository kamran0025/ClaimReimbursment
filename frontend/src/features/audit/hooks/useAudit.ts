import { useQuery } from '@tanstack/react-query';
import { auditApi } from '@/services/api';
import type { AuditFilters } from '@/services/api/auditService';
import type { PageParams } from '@/types/api';

export function useClaimAudit(claimId: string | undefined) {
  return useQuery({
    queryKey: ['audit', 'claim', claimId],
    queryFn: () => auditApi.listAuditForClaim(claimId!),
    enabled: !!claimId,
  });
}

export function useAllAudit(filters?: AuditFilters, page?: PageParams) {
  return useQuery({
    queryKey: ['audit', 'all', filters ?? {}, page ?? {}],
    queryFn: () => auditApi.listAllAudit(filters, page),
  });
}
