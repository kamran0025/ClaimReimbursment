import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSpinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { useClaim } from '@/features/claims/hooks/useClaims';
import { ClaimDetailView } from '@/features/claims/components/ClaimDetailView';
import { ClaimDecisionActions } from '@/features/claims/components/ClaimDecisionActions';
import { useAuth } from '@/app/AuthContext';
import { canDecideClaim, isAtFinanceStage } from '@/services/api/stateMachine';
import { CLAIM_STATUS_LABELS } from '@/types/enums';

/**
 * v2: a single decision point — Approve / Reject / Request Info — with no
 * step numbers or chain progress. `ClaimDecisionActions` itself figures out
 * whether this claim is currently decidable by the signed-in approver.
 */
export function ClaimReviewPage() {
  const { claimId } = useParams<{ claimId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: claim, isLoading, isError, error, refetch } = useClaim(claimId);

  if (isLoading) return <PageSpinner />;
  if (isError || !claim) return <ErrorState error={error} onRetry={() => refetch()} />;

  const canDecide = !!user && canDecideClaim(claim, user);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Claim Review" actions={<Link to="/approver/claims"><Button variant="outline">Back to My Claims</Button></Link>} />

      {!canDecide && (
        <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {isAtFinanceStage(claim)
            ? 'You approved this claim. It is above the Finance-approval limit and is now waiting for Finance to make the final decision.'
            : `This claim is ${CLAIM_STATUS_LABELS[claim.status].toLowerCase()} — no action is available.`}
        </div>
      )}

      <ClaimDetailView
        claim={claim}
        showClaimant
        actions={<ClaimDecisionActions claim={claim} onDecided={() => navigate('/approver/claims')} />}
      />
    </div>
  );
}
