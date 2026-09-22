// Finance CSV export. The real endpoint streams `text/csv` directly (no
// `{success,data}` envelope), so this goes through `apiGetRaw` and reads the
// body as text.
import type { ClaimStatus } from '@/types/enums';
import { apiGetRaw } from './httpClient';

export interface ExportFilters {
  dateFrom?: string;
  dateTo?: string;
  status?: ClaimStatus[];
}

export interface ExportResult {
  csv: string;
  filename: string;
  rowCount: number;
}

function filenameFromContentDisposition(header: string | null): string | null {
  const match = header?.match(/filename="?([^"]+)"?/);
  return match ? match[1] : null;
}

export async function exportClaims(filters: ExportFilters): Promise<ExportResult> {
  const res = await apiGetRaw('/finance/export', {
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    status: filters.status,
  });
  const csv = await res.text();
  const filename = filenameFromContentDisposition(res.headers.get('Content-Disposition')) ?? `claims-export-${new Date().toISOString().slice(0, 10)}.csv`;
  // First line is the header row; an empty export is just the header with no trailing newline.
  const lines = csv.split('\n').filter((line) => line.length > 0);
  const rowCount = Math.max(0, lines.length - 1);
  return { csv, filename, rowCount };
}
