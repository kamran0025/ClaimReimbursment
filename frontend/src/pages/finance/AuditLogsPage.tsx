import { useState } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/ErrorState';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useAllAudit } from '@/features/audit/hooks/useAudit';
import { AuditTrail } from '@/features/audit/components/AuditTrail';

export function AuditLogsPage() {
  const [claimId, setClaimId] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, refetch } = useAllAudit(claimId ? { claimId } : undefined, { page, pageSize: 20 });

  return (
    <div>
      <PageHeader title="Audit Logs" subtitle="Every state-changing action across every claim, organization-wide." />

      <div className="mb-4 max-w-sm">
        <Input
          placeholder="Filter by claim ID…"
          value={claimId}
          onChange={(e) => {
            setClaimId(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <Card>
        <div className="p-4">
          {isLoading && <SkeletonRows rows={8} cols={1} />}
          {isError && <ErrorState error={error} onRetry={() => refetch()} />}
          {data && <AuditTrail logs={data.items} showClaimId />}
        </div>
        {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />}
      </Card>
    </div>
  );
}
