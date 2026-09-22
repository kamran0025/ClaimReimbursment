import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { ClaimFilterBar } from '@/components/common/ClaimFilterBar';
import type { ClaimFilterValues } from '@/components/common/ClaimFilterBar';
import { ErrorState } from '@/components/common/ErrorState';
import { ClaimStatusBadge } from '@/components/common/StatusBadge';
import { Card } from '@/components/ui/Card';
import { Table } from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { useClaims } from '@/features/claims/hooks/useClaims';
import { useAuth } from '@/app/AuthContext';
import { toClaimFilters } from '@/utils/toClaimFilters';
import { isInReview } from '@/services/api/stateMachine';
import { ClaimStatus } from '@/types/enums';
import { formatDate, formatDateTime, formatInr } from '@/utils/format';
import type { Claim } from '@/types/models';

const STATUS_OPTIONS = [
  { value: ClaimStatus.PENDING_APPROVAL, label: 'Pending' },
  { value: ClaimStatus.INFO_REQUESTED, label: 'Awaiting Claimant Response' },
  { value: ClaimStatus.APPROVED, label: 'Approved' },
  { value: ClaimStatus.REJECTED, label: 'Rejected' },
];

const EMPTY_STATE: Record<string, { title: string; description: string }> = {
  '': { title: 'No claims found', description: 'No claims are currently assigned to you.' },
  [ClaimStatus.PENDING_APPROVAL]: {
    title: 'Nothing to review',
    description: "You're all caught up — no claims are currently awaiting your decision.",
  },
  [ClaimStatus.INFO_REQUESTED]: {
    title: 'Nothing awaiting a response',
    description: "Claims you've asked for more info on will show up here until the claimant responds.",
  },
  [ClaimStatus.APPROVED]: { title: 'No approvals yet', description: 'Claims you approve will show up here.' },
  [ClaimStatus.REJECTED]: { title: 'No rejections yet', description: 'Claims you reject will show up here.' },
};

/**
 * v2: a single filtered list of claims assigned to me — claims needing a
 * decision, claims awaiting the claimant's response, my own past decisions,
 * or (via "All") everything at once — switched via the "View By Status"
 * dropdown. Scoping to `assignedApproverId === self` happens server-side
 * (mock service layer), so this list can never show another approver's
 * claims.
 *
 * For the Approved/Rejected views we additionally filter by `decidedById`:
 * Finance can also decide a claim assigned to an approver, and this list is
 * meant to show only decisions this approver personally made.
 */
export function AssignedClaimsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [filterValues, setFilterValues] = useState<ClaimFilterValues>({ status: ClaimStatus.PENDING_APPROVAL });
  const [page, setPage] = useState(1);

  const status = filterValues.status;
  const isDecidedView = status === ClaimStatus.APPROVED || status === ClaimStatus.REJECTED;

  const filters = toClaimFilters(filterValues);
  if (isDecidedView && user) filters.decidedById = user.id;

  const { data, isLoading, isError, error, refetch } = useClaims(filters, { page, pageSize: 10 });

  const columns: Column<Claim>[] = [
    { key: 'title', header: 'Claim', render: (c) => <span className="font-medium text-slate-800">{c.title}</span> },
    { key: 'claimant', header: 'Claimant', render: (c) => c.claimant?.name ?? c.claimantId },
    { key: 'status', header: isDecidedView ? 'Decision' : 'Status', render: (c) => <ClaimStatusBadge status={c.status} /> },
    { key: 'amount', header: 'Amount', headerClassName: 'text-right', className: 'text-right font-medium', render: (c) => formatInr(c.total) },
    isDecidedView
      ? { key: 'decidedAt', header: 'Decided', render: (c) => formatDateTime(c.decidedAt) }
      : { key: 'submitted', header: 'Submitted', render: (c) => formatDate(c.submittedAt) },
    ...(isDecidedView
      ? []
      : [
          {
            key: 'actions',
            header: '',
            headerClassName: 'text-right',
            className: 'text-right',
            render: (c: Claim) => (
              <Button size="sm" onClick={() => navigate(`/approver/claims/${c.id}`)}>
                {isInReview(c.status) ? 'Review' : 'View'}
              </Button>
            ),
          },
        ]),
  ];

  const emptyState = EMPTY_STATE[status ?? ClaimStatus.PENDING_APPROVAL];

  return (
    <div>
      <PageHeader title="My Claims" subtitle="Claims assigned to you." />

      <ClaimFilterBar
        values={filterValues}
        onChange={(v) => {
          setFilterValues(v);
          setPage(1);
        }}
        showSearch={false}
        statusOptions={STATUS_OPTIONS}
        allowAllStatus
        allStatusLabel="All"
      />

      <Card>
        {isLoading && <SkeletonRows rows={5} cols={6} />}
        {isError && (
          <div className="p-4">
            <ErrorState error={error} onRetry={() => refetch()} />
          </div>
        )}
        {data && data.items.length === 0 && <EmptyState title={emptyState.title} description={emptyState.description} />}
        {data && data.items.length > 0 && (
          <>
            <Table columns={columns} rows={data.items} rowKey={(c) => c.id} onRowClick={(c) => navigate(`/approver/claims/${c.id}`)} />
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
