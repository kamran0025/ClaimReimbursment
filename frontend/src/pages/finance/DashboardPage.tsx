import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSpinner } from '@/components/ui/Spinner';
import { useFinanceDashboard } from '@/features/finance/hooks/useFinance';
import { formatInr } from '@/utils/format';
import { CLAIM_STATUS_LABELS, ClaimStatus } from '@/types/enums';

export function FinanceDashboardPage() {
  const { data, isLoading, isError, error, refetch } = useFinanceDashboard();

  return (
    <div>
      <PageHeader title="Finance Dashboard" subtitle="Organization-wide claim overview." />

      {isLoading && <PageSpinner />}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="Total claims" value={data.totalClaims} accent="slate" />
            <StatCard label="Total approved" value={formatInr(data.totalApprovedAmount)} accent="green" />
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
            {Object.entries(data.counts)
              .filter(([status]) => status !== ClaimStatus.DRAFT)
              .map(([status, count]) => (
                <StatCard key={status} label={CLAIM_STATUS_LABELS[status as keyof typeof CLAIM_STATUS_LABELS]} value={count} />
              ))}
          </div>
        </>
      )}
    </div>
  );
}
