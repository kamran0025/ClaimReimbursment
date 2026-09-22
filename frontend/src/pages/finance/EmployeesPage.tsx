import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/ErrorState';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Table } from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useEmployees } from '@/features/finance/hooks/useFinance';
import { ROLE_LABEL } from '@/layouts/navConfig';
import { formatDate } from '@/utils/format';
import type { User } from '@/types/models';

export function EmployeesPage() {
  const { data, isLoading, isError, error, refetch } = useEmployees();

  const columns: Column<User>[] = [
    { key: 'name', header: 'Name', render: (u) => <span className="font-medium text-slate-800">{u.name}</span> },
    { key: 'email', header: 'Email', render: (u) => u.email },
    { key: 'role', header: 'Role', render: (u) => <Badge color={u.role === 'APPROVER' ? 'purple' : 'blue'}>{ROLE_LABEL[u.role]}</Badge> },
    { key: 'status', header: 'Status', render: (u) => <Badge color={u.isActive ? 'green' : 'gray'}>{u.isActive ? 'Active' : 'Inactive'}</Badge> },
    { key: 'joined', header: 'Joined', render: (u) => formatDate(u.createdAt) },
  ];

  return (
    <div>
      <PageHeader title="Employees" subtitle="Claimants and approvers in the organization." />
      <Card>
        {isLoading && <SkeletonRows rows={6} cols={5} />}
        {isError && (
          <div className="p-4">
            <ErrorState error={error} onRetry={() => refetch()} />
          </div>
        )}
        {data && <Table columns={columns} rows={data} rowKey={(u) => u.id} />}
      </Card>
    </div>
  );
}
