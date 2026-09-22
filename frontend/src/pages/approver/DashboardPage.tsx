import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSpinner } from '@/components/ui/Spinner';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Table } from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { useApproverDashboard } from '@/features/claims/hooks/useClaimDecisions';
import { useAuth } from '@/app/AuthContext';
import { formatDate, formatInr } from '@/utils/format';
import type { Claim } from '@/types/models';

export function ApproverDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading, isError, error, refetch } = useApproverDashboard();

  const claims: Claim[] = data?.pendingClaims ?? [];

  const columns: Column<Claim>[] = [
    { key: 'title', header: 'Claim', render: (c) => <span className="font-medium text-slate-800">{c.title}</span> },
    { key: 'claimant', header: 'Claimant', render: (c) => c.claimant?.name ?? c.claimantId },
    { key: 'amount', header: 'Amount', headerClassName: 'text-right', className: 'text-right font-medium', render: (c) => formatInr(c.total) },
    { key: 'submitted', header: 'Submitted', render: (c) => formatDate(c.submittedAt) },
    {
      key: 'actions',
      header: '',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (c) => (
        <Button size="sm" onClick={() => navigate(`/approver/claims/${c.id}`)}>
          Review
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user?.name.split(' ')[0]}`}
        subtitle="Here's what needs your attention."
        actions={
          <Link to="/approver/claims">
            <Button>View My Claims</Button>
          </Link>
        }
      />

      {isLoading && <PageSpinner />}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <StatCard label="Pending your review" value={data.pendingCount} accent="amber" />
            <StatCard label="Awaiting claimant" value={data.infoRequestedCount} accent="orange" />
            <StatCard label="Approved today" value={data.approvedToday} accent="green" />
            <StatCard label="Rejected (all time)" value={data.rejectedCount} accent="red" />
            <StatCard label="Total pending amount" value={formatInr(data.totalPendingAmount)} accent="slate" />
          </div>

          <Card className="mt-6">
            <CardHeader
              title="Remaining to approve"
              action={
                <Link to="/approver/claims" className="text-sm font-medium text-slate-600 hover:text-slate-900">
                  View all →
                </Link>
              }
            />
            <CardBody>
              {claims.length === 0 ? (
                <EmptyState title="You're all caught up" description="No claims are currently awaiting your decision." />
              ) : (
                <Table columns={columns} rows={claims} rowKey={(c) => c.id} onRowClick={(c) => navigate(`/approver/claims/${c.id}`)} />
              )}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
