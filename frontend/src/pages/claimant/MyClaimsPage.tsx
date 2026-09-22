import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { ClaimFilterBar } from '@/components/common/ClaimFilterBar';
import type { ClaimFilterValues } from '@/components/common/ClaimFilterBar';
import { ClaimStatusBadge } from '@/components/common/StatusBadge';
import { ErrorState } from '@/components/common/ErrorState';
import { Card } from '@/components/ui/Card';
import { Table } from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { useClaims } from '@/features/claims/hooks/useClaims';
import { toClaimFilters } from '@/utils/toClaimFilters';
import { formatDate, formatInr } from '@/utils/format';
import type { Claim } from '@/types/models';
import { isEditableStatus } from '@/services/api/stateMachine';

export function MyClaimsPage() {
  const [filterValues, setFilterValues] = useState<ClaimFilterValues>({});
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  const filters = toClaimFilters(filterValues);
  const { data, isLoading, isError, error, refetch } = useClaims(filters, { page, pageSize: 10 });

  const columns: Column<Claim>[] = [
    { key: 'title', header: 'Title', render: (c) => <span className="font-medium text-slate-800">{c.title}</span> },
    { key: 'status', header: 'Status', render: (c) => <ClaimStatusBadge status={c.status} /> },
    { key: 'total', header: 'Amount', headerClassName: 'text-right', className: 'text-right font-medium', render: (c) => formatInr(c.total) },
    { key: 'created', header: 'Created', render: (c) => formatDate(c.createdAt) },
    {
      key: 'actions',
      header: '',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (c) =>
        isEditableStatus(c.status) ? (
          <Link to={`/claimant/claims/${c.id}/edit`} onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="outline">
              Edit
            </Button>
          </Link>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="My Claims"
        actions={
          <Link to="/claimant/claims/new">
            <Button>New Claim</Button>
          </Link>
        }
      />

      <ClaimFilterBar values={filterValues} onChange={(v) => { setFilterValues(v); setPage(1); }} showAmountRange />

      <Card>
        {isLoading && <SkeletonRows rows={6} cols={5} />}
        {isError && (
          <div className="p-4">
            <ErrorState error={error} onRetry={() => refetch()} />
          </div>
        )}
        {data && data.items.length === 0 && <EmptyState title="No claims found" description="Try adjusting your filters, or create a new claim." />}
        {data && data.items.length > 0 && (
          <>
            <Table columns={columns} rows={data.items} rowKey={(c) => c.id} onRowClick={(c) => navigate(`/claimant/claims/${c.id}`)} />
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
