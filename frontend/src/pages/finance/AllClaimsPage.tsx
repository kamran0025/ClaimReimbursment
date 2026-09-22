import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { ClaimFilterBar } from '@/components/common/ClaimFilterBar';
import type { ClaimFilterValues } from '@/components/common/ClaimFilterBar';
import { ClaimStatusBadge } from '@/components/common/StatusBadge';
import { ErrorState } from '@/components/common/ErrorState';
import { Card } from '@/components/ui/Card';
import { Table } from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useClaims, useActiveApprovers } from '@/features/claims/hooks/useClaims';
import { useEmployees } from '@/features/finance/hooks/useFinance';
import { toClaimFilters } from '@/utils/toClaimFilters';
import { formatDate, formatInr } from '@/utils/format';
import { Role, ClaimStatus, CLAIM_STATUS_LABELS } from '@/types/enums';
import type { Claim } from '@/types/models';

// Finance never sees DRAFT claims (they're unsubmitted, claimant-private), so it's excluded here too.
const STATUS_OPTIONS = Object.values(ClaimStatus)
  .filter((s) => s !== ClaimStatus.DRAFT)
  .map((s) => ({ value: s, label: CLAIM_STATUS_LABELS[s] }));

export function AllClaimsPage() {
  const [filterValues, setFilterValues] = useState<ClaimFilterValues>({});
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  const filters = toClaimFilters(filterValues);
  const { data, isLoading, isError, error, refetch } = useClaims(filters, { page, pageSize: 10 });
  const { data: employees } = useEmployees();
  const { data: approvers } = useActiveApprovers();
  const claimantOptions = employees?.filter((e) => e.role === Role.CLAIMANT).map((e) => ({ id: e.id, name: e.name }));
  const approverOptions = approvers?.map((a) => ({ id: a.id, name: a.name }));

  const columns: Column<Claim>[] = [
    { key: 'title', header: 'Title', render: (c) => <span className="font-medium text-slate-800">{c.title}</span> },
    { key: 'claimant', header: 'Claimant', render: (c) => c.claimant?.name ?? c.claimantId },
    { key: 'approver', header: 'Assigned Approver', render: (c) => c.assignedApprover?.name ?? '—' },
    { key: 'status', header: 'Status', render: (c) => <ClaimStatusBadge status={c.status} /> },
    { key: 'total', header: 'Amount', headerClassName: 'text-right', className: 'text-right font-medium', render: (c) => formatInr(c.total) },
    { key: 'created', header: 'Created', render: (c) => formatDate(c.createdAt) },
  ];

  return (
    <div>
      <PageHeader title="All Claims" subtitle="Organization-wide claim visibility." />

      <ClaimFilterBar
        values={filterValues}
        onChange={(v) => {
          setFilterValues(v);
          setPage(1);
        }}
        claimantOptions={claimantOptions}
        approverOptions={approverOptions}
        statusOptions={STATUS_OPTIONS}
      />

      <Card>
        {isLoading && <SkeletonRows rows={6} cols={5} />}
        {isError && (
          <div className="p-4">
            <ErrorState error={error} onRetry={() => refetch()} />
          </div>
        )}
        {data && data.items.length === 0 && <EmptyState title="No claims found" description="Try adjusting your filters." />}
        {data && data.items.length > 0 && (
          <>
            <Table columns={columns} rows={data.items} rowKey={(c) => c.id} onRowClick={(c) => navigate(`/finance/claims/${c.id}`)} />
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
