import { useMutation, useQueryClient } from '@tanstack/react-query';
import { claimsApi } from '@/services/api';
import type {
  ClaimItemInput,
  CreateClaimInput,
  ReceiptInput,
  UpdateClaimInput,
} from '@/services/api/claimsService';
import { claimDetailKey } from './useClaims';

/**
 * Shared invalidation: claim detail, claim lists, claimant dashboard, and
 * the audit trail all read from the same mock store, so every mutation
 * that touches a claim must invalidate all four — the audit trail in
 * particular must never show stale/incomplete history after an action.
 */
function useInvalidateClaims() {
  const queryClient = useQueryClient();
  return (claimId?: string) => {
    queryClient.invalidateQueries({ queryKey: ['claims'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['audit'] });
    if (claimId) queryClient.invalidateQueries({ queryKey: claimDetailKey(claimId) });
  };
}

export function useCreateClaim() {
  const invalidate = useInvalidateClaims();
  return useMutation({
    mutationFn: (input: CreateClaimInput) => claimsApi.createClaim(input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateClaim(claimId: string) {
  const invalidate = useInvalidateClaims();
  return useMutation({
    mutationFn: (input: UpdateClaimInput) => claimsApi.updateClaim(claimId, input),
    onSuccess: () => invalidate(claimId),
  });
}

export function useAddItem(claimId: string) {
  const invalidate = useInvalidateClaims();
  return useMutation({
    mutationFn: (input: ClaimItemInput) => claimsApi.addItem(claimId, input),
    onSuccess: () => invalidate(claimId),
  });
}

export function useUpdateItem(claimId: string) {
  const invalidate = useInvalidateClaims();
  return useMutation({
    mutationFn: ({ itemId, input }: { itemId: string; input: ClaimItemInput }) => claimsApi.updateItem(claimId, itemId, input),
    onSuccess: () => invalidate(claimId),
  });
}

export function useDeleteItem(claimId: string) {
  const invalidate = useInvalidateClaims();
  return useMutation({
    mutationFn: (itemId: string) => claimsApi.deleteItem(claimId, itemId),
    onSuccess: () => invalidate(claimId),
  });
}

export function useAddReceipt(claimId: string) {
  const invalidate = useInvalidateClaims();
  return useMutation({
    mutationFn: (input: ReceiptInput) => claimsApi.addReceipt(claimId, input),
    onSuccess: () => invalidate(claimId),
  });
}

export function useDeleteReceipt(claimId: string) {
  const invalidate = useInvalidateClaims();
  return useMutation({
    mutationFn: (receiptId: string) => claimsApi.deleteReceipt(claimId, receiptId),
    onSuccess: () => invalidate(claimId),
  });
}

export function useSubmitClaim(claimId: string) {
  const invalidate = useInvalidateClaims();
  return useMutation({
    mutationFn: (assignedApproverId: string) => claimsApi.submitClaim(claimId, assignedApproverId),
    onSuccess: () => invalidate(claimId),
  });
}

export function useResubmitClaim(claimId: string) {
  const invalidate = useInvalidateClaims();
  return useMutation({
    mutationFn: (assignedApproverId: string) => claimsApi.resubmitClaim(claimId, assignedApproverId),
    onSuccess: () => invalidate(claimId),
  });
}

export function useCancelClaim(claimId: string) {
  const invalidate = useInvalidateClaims();
  return useMutation({
    mutationFn: () => claimsApi.cancelClaim(claimId),
    onSuccess: () => invalidate(claimId),
  });
}
