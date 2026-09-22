import { Link, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSpinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { useClaim } from '@/features/claims/hooks/useClaims';
import { ClaimDetailView } from '@/features/claims/components/ClaimDetailView';
import { isEditableStatus } from '@/services/api/stateMachine';

export function ClaimDetailsPage() {
  const { claimId } = useParams<{ claimId: string }>();
  const { data: claim, isLoading, isError, error, refetch } = useClaim(claimId);

  if (isLoading) return <PageSpinner />;
  if (isError || !claim) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Claim Details" actions={<Link to="/claimant/claims"><Button variant="outline">Back to My Claims</Button></Link>} />
      <ClaimDetailView
        claim={claim}
        actions={
          isEditableStatus(claim.status) ? (
            <Link to={`/claimant/claims/${claim.id}/edit`}>
              <Button size="sm">Edit Claim</Button>
            </Link>
          ) : undefined
        }
      />
    </div>
  );
}
