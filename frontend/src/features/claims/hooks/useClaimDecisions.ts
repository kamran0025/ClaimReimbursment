import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { claimsApi, dashboardApi } from '@/services/api';
import type { RespondToInfoRequestInput } from '@/services/api/claimsService';
import { claimDetailKey } from './useClaims';

function useInvalidateClaims() {
  const queryClient = useQueryClient();
  return (claimId?: string) => {
    queryClient.invalidateQueries({ queryKey: ['claims'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['audit'] });
    if (claimId) queryClient.invalidateQueries({ queryKey: claimDetailKey(claimId) });
  };
}

export function useApproveClaim(claimId: string) {
  const invalidate = useInvalidateClaims();
  return useMutation({
    mutationFn: () => claimsApi.approveClaim(claimId),
    onSuccess: () => invalidate(claimId),
  });
}

export function useRejectClaim(claimId: string) {
  const invalidate = useInvalidateClaims();
  return useMutation({
    mutationFn: (reason: string) => claimsApi.rejectClaim(claimId, reason),
    onSuccess: () => invalidate(claimId),
  });
}

export function useRequestInfo(claimId: string) {
  const invalidate = useInvalidateClaims();
  return useMutation({
    mutationFn: (message: string) => claimsApi.requestInfo(claimId, message),
    onSuccess: () => invalidate(claimId),
  });
}

export function useRespondToInfoRequest(claimId: string) {
  const invalidate = useInvalidateClaims();
  return useMutation({
    mutationFn: (input: RespondToInfoRequestInput) => claimsApi.respondToInfoRequest(claimId, input),
    onSuccess: () => invalidate(claimId),
  });
}

export function useApproverDashboard() {
  return useQuery({
    queryKey: ['dashboard', 'approver'],
    queryFn: () => dashboardApi.getApproverDashboard(),
  });
}
