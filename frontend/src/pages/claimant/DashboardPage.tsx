import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSpinner } from '@/components/ui/Spinner';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { ClaimStatusBadge } from '@/components/common/StatusBadge';
import { useClaimantDashboard } from '@/features/claims/hooks/useClaimantDashboard';
import { useAuth } from '@/app/AuthContext';
import { formatDate, formatInr } from '@/utils/format';

export function ClaimantDashboardPage() {
  const { user } = useAuth();
  const { data, isLoading, isError, error, refetch } = useClaimantDashboard();

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user?.name.split(' ')[0]}`}
        subtitle="Here's an overview of your expense claims."
        actions={
          <Link to="/claimant/claims/new">
            <Button>New Claim</Button>
          </Link>
        }
      />

      {isLoading && <PageSpinner />}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
            <StatCard label="Draft" value={data.counts.DRAFT} accent="slate" />
            <StatCard label="Pending approval" value={data.counts.PENDING_APPROVAL} accent="amber" />
            <StatCard label="Info requested" value={data.counts.INFO_REQUESTED} accent="orange" />
            <StatCard label="Rejected" value={data.counts.REJECTED} accent="red" />
            <StatCard label="Approved" value={data.counts.APPROVED} accent="green" />
            <StatCard label="Cancelled" value={data.counts.CANCELLED} accent="slate" />
            <StatCard
              label="Total claims"
              value={Object.values(data.counts).reduce((a, b) => a + b, 0)}
              accent="slate"
            />
          </div>

          <Card className="mt-6">
            <CardHeader
              title="Recent claims"
              action={
                <Link to="/claimant/claims" className="text-sm font-medium text-slate-600 hover:text-slate-900">
                  View all →
                </Link>
              }
            />
            <CardBody>
              {data.recentClaims.length === 0 ? (
                <EmptyState
                  title="No claims yet"
                  description="Create your first expense claim to get started."
                  action={
                    <Link to="/claimant/claims/new">
                      <Button size="sm">New Claim</Button>
                    </Link>
                  }
                />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.recentClaims.map((c) => (
                    <li key={c.id}>
                      <Link to={`/claimant/claims/${c.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-slate-50">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-800">{c.title}</p>
                          <p className="text-xs text-slate-400">{formatDate(c.createdAt)}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="text-sm font-medium text-slate-700">{formatInr(c.total)}</span>
                          <ClaimStatusBadge status={c.status} />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
