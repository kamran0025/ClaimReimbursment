import { useQuery } from '@tanstack/react-query';
import { claimsApi, usersApi } from '@/services/api';
import type { ClaimFilters } from '@/services/api/claimsService';
import type { PageParams } from '@/types/api';

/** Active approvers, for the "assign an approver" dropdown shown at submit/resubmit time. */
export function useActiveApprovers() {
  return useQuery({
    queryKey: ['users', 'active-approvers'],
    queryFn: () => usersApi.listActiveApprovers(),
  });
}

export function claimsListKey(filters?: ClaimFilters, page?: PageParams) {
  return ['claims', 'list', filters ?? {}, page ?? {}] as const;
}

export function useClaims(filters?: ClaimFilters, page?: PageParams) {
  return useQuery({
    queryKey: claimsListKey(filters, page),
    queryFn: () => claimsApi.listClaims(filters, page),
  });
}

export function claimDetailKey(claimId: string | undefined) {
  return ['claims', 'detail', claimId] as const;
}

export function useClaim(claimId: string | undefined) {
  return useQuery({
    queryKey: claimDetailKey(claimId),
    queryFn: () => claimsApi.getClaim(claimId!),
    enabled: !!claimId,
  });
}
