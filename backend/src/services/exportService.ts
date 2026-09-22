// Finance CSV export — plan-backend.md §11 (`GET /finance/export`). Filtering
// happens in the DB query (`where`), and rows are pulled in bounded batches
// rather than loading the whole claims table into memory at once; the route
// streams each line to the response as it's produced.
import type { ClaimStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { getClaimScopeFilter, type ScopeUser } from './claimScope';

export interface ExportFilters {
  dateFrom?: string;
  dateTo?: string;
  status?: ClaimStatus[];
}

const HEADERS = ['Claim ID', 'Title', 'Claimant', 'Claimant Email', 'Assigned Approver', 'Status', 'Total (INR)', 'Submitted At', 'Created At'];

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function toRow(values: (string | number)[]): string {
  return values.map((v) => escapeCsv(String(v ?? ''))).join(',');
}

const BATCH_SIZE = 500;

/** Yields the CSV header line, then every matching claim as one row, in `BATCH_SIZE` DB round-trips. */
export async function* streamClaimsCsv(user: ScopeUser, filters: ExportFilters): AsyncGenerator<string> {
  yield toRow(HEADERS);

  const where = {
    AND: [
      getClaimScopeFilter(user),
      filters.dateFrom || filters.dateTo
        ? {
            createdAt: {
              ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
              ...(filters.dateTo ? { lte: new Date(`${filters.dateTo}T23:59:59.999Z`) } : {}),
            },
          }
        : {},
      filters.status?.length ? { status: { in: filters.status } } : {},
    ],
  };

  let skip = 0;
  for (;;) {
    const batch = await prisma.claim.findMany({
      where,
      include: { claimant: true, assignedApprover: true },
      orderBy: { createdAt: 'asc' },
      skip,
      take: BATCH_SIZE,
    });
    if (batch.length === 0) break;

    for (const c of batch) {
      yield toRow([
        c.id,
        c.title,
        c.claimant.name,
        c.claimant.email,
        c.assignedApprover?.name ?? '',
        c.status,
        Number(c.total).toFixed(2),
        c.submittedAt ? c.submittedAt.toISOString() : '',
        c.createdAt.toISOString(),
      ]);
    }
    skip += BATCH_SIZE;
    if (batch.length < BATCH_SIZE) break;
  }
}

export function exportFilename(): string {
  return `claims-export-${new Date().toISOString().slice(0, 10)}.csv`;
}
