import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSpinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { useClaim } from '@/features/claims/hooks/useClaims';
import { ClaimDetailView } from '@/features/claims/components/ClaimDetailView';
import { ClaimDecisionActions } from '@/features/claims/components/ClaimDecisionActions';
import { isInReview } from '@/services/api/stateMachine';

/**
 * v2: Finance gets the same Approve/Reject/Request-Info actions as an
 * approver, usable on any claim still in review regardless of assignment
 * (plan-backend.md §6) — so this single screen doubles as both Finance's
 * "Claim Review" (while in review) and read-only "Claim Details" (otherwise).
 */
export function FinanceClaimDetailsPage() {
  const { claimId } = useParams<{ claimId: string }>();
  const navigate = useNavigate();
  const { data: claim, isLoading, isError, error, refetch } = useClaim(claimId);

  if (isLoading) return <PageSpinner />;
  if (isError || !claim) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={isInReview(claim.status) ? 'Claim Review' : 'Claim Details'}
        actions={<Link to="/finance/claims"><Button variant="outline">Back to All Claims</Button></Link>}
      />
      <ClaimDetailView
        claim={claim}
        showClaimant
        actions={<ClaimDecisionActions claim={claim} onDecided={() => navigate('/finance/claims')} />}
      />
    </div>
  );
}
