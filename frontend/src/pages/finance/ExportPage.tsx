import { useState } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/common/ErrorState';
import { useExportClaims } from '@/features/finance/hooks/useFinance';
import { useToast } from '@/app/ToastContext';
import { ClaimStatus, CLAIM_STATUS_LABELS } from '@/types/enums';
import { downloadCsv } from '@/utils/csv';

/** Mirrors the real `GET /finance/export` contract: date range + status filters, CSV output. */
export function ExportPage() {
  const toast = useToast();
  const exportClaims = useExportClaims();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [status, setStatus] = useState<ClaimStatus | ''>('');

  const handleExport = async () => {
    try {
      const result = await exportClaims.mutateAsync({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        status: status ? [status] : undefined,
      });
      if (result.rowCount === 0) {
        toast.info('No claims matched your filters', 'Try widening the date range or clearing the status filter.');
        return;
      }
      downloadCsv(result.csv, result.filename);
      toast.success('Export ready', `${result.rowCount} claim(s) exported to ${result.filename}`);
    } catch {
      // error rendered inline
    }
  };

  return (
    <div className="max-w-xl">
      <PageHeader title="Export Claims" subtitle="Download a CSV of claims matching the filters below." />
      <Card>
        <CardBody>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="From date" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <Input label="To date" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="mt-4">
            <Select label="Status (optional)" placeholder="All statuses" value={status} onChange={(e) => setStatus(e.target.value as ClaimStatus)}>
              {Object.values(ClaimStatus)
                .filter((s) => s !== ClaimStatus.DRAFT)
                .map((s) => (
                  <option key={s} value={s}>
                    {CLAIM_STATUS_LABELS[s]}
                  </option>
                ))}
            </Select>
          </div>
          {exportClaims.isError ? (
            <div className="mt-4">
              <ErrorState error={exportClaims.error} />
            </div>
          ) : null}
          <div className="mt-5 flex justify-end">
            <Button onClick={handleExport} isLoading={exportClaims.isPending}>
              Export CSV
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
