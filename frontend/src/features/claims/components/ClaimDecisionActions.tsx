import { useState } from 'react';
import type { ClaimDetail } from '@/types/models';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DecisionMessageModal } from './DecisionMessageModal';
import { useApproveClaim, useRejectClaim } from '@/features/claims/hooks/useClaimDecisions';
import { useAuth } from '@/app/AuthContext';
import { useToast } from '@/app/ToastContext';
import { ClaimStatus, Role } from '@/types/enums';
import { canDecideClaim, isAtFinanceStage } from '@/services/api/stateMachine';
import { formatInr } from '@/utils/format';

/**
 * The two direct decision actions — Approve / Reject — usable by the
 * claim's `assignedApproverId`, or by any Finance user, while the claim is
 * still in review (plan-backend.md §6, extended so a decision-maker isn't
 * blocked from deciding just because a conversation is in progress). For a
 * claim above the Finance-approval threshold the approver's Approve
 * escalates it to Finance, and from then on only Finance sees these actions. Requesting more information is handled
 * inline in the Messages panel (`ClaimMessagesPanel`) instead, since it's
 * just the next chat message rather than a one-off decision. Renders
 * nothing when the current user may not decide this claim right now, so
 * callers can drop it straight into `ClaimDetailView`'s `actions` slot.
 */
export function ClaimDecisionActions({ claim, onDecided }: { claim: ClaimDetail; onDecided?: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const approveClaim = useApproveClaim(claim.id);
  const rejectClaim = useRejectClaim(claim.id);
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [showReject, setShowReject] = useState(false);

  if (!user) return null;
  if (!canDecideClaim(claim, user)) return null;
  // The approver's sign-off on a high-value claim escalates it instead of closing it.
  const willEscalate = user.role !== Role.FINANCE && claim.requiresFinanceApproval && !isAtFinanceStage(claim);

  return (
    <>
      <Button variant="danger" onClick={() => setShowReject(true)}>
        Reject
      </Button>
      <Button onClick={() => setConfirmApprove(true)}>Approve</Button>

      <ConfirmDialog
        isOpen={confirmApprove}
        title="Approve claim"
        message={
          willEscalate
            ? `Approve "${claim.title}" for ${formatInr(claim.total)}? Claims of this amount also need Finance approval, so it will be sent to Finance for the final decision.`
            : `Approve "${claim.title}" for ${formatInr(claim.total)}?`
        }
        confirmLabel="Approve"
        isLoading={approveClaim.isPending}
        onConfirm={async () => {
          try {
            const updated = await approveClaim.mutateAsync();
            toast.success(updated.status === ClaimStatus.PENDING_FINANCE_APPROVAL ? 'Approved — sent to Finance for final approval' : 'Claim approved');
            onDecided?.();
          } catch (err) {
            toast.error('Could not approve claim', err instanceof Error ? err.message : undefined);
          } finally {
            setConfirmApprove(false);
          }
        }}
        onCancel={() => setConfirmApprove(false)}
      />

      <DecisionMessageModal
        isOpen={showReject}
        title="Reject claim"
        fieldLabel="Rejection reason"
        placeholder="Explain what needs to change before this can be resubmitted…"
        confirmLabel="Reject Claim"
        confirmVariant="danger"
        isSubmitting={rejectClaim.isPending}
        submitError={rejectClaim.error}
        onClose={() => setShowReject(false)}
        onSubmit={async (reason) => {
          try {
            await rejectClaim.mutateAsync(reason);
            toast.success('Claim rejected');
            setShowReject(false);
            onDecided?.();
          } catch {
            // error rendered inline
          }
        }}
      />
    </>
  );
}
