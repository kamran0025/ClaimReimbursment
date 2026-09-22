import type { AuditLog } from '@/types/models';
import { formatDateTime } from '@/utils/format';
import { EmptyState } from '@/components/ui/EmptyState';

const ACTION_LABELS: Record<string, string> = {
  CLAIM_CREATED: 'Claim created',
  CLAIM_UPDATED: 'Claim updated',
  ITEM_ADDED: 'Line item added',
  ITEM_UPDATED: 'Line item updated',
  ITEM_DELETED: 'Line item deleted',
  RECEIPT_UPLOADED: 'Receipt uploaded',
  RECEIPT_DELETED: 'Receipt removed',
  CLAIM_SUBMITTED: 'Claim submitted for approval',
  CLAIM_RESUBMITTED: 'Claim resubmitted for approval',
  CLAIM_CANCELLED: 'Claim cancelled',
  CLAIM_INFO_REQUESTED: 'Information requested',
  CLAIM_INFO_RESPONDED: 'Claimant responded to info request',
  CLAIM_APPROVED: 'Claim approved',
  CLAIM_REJECTED: 'Claim rejected',
};

export function AuditTrail({ logs, showClaimId }: { logs: AuditLog[]; showClaimId?: boolean }) {
  if (logs.length === 0) {
    return <EmptyState title="No audit history yet" description="Actions taken on this claim will appear here." />;
  }

  return (
    <ol className="relative flex flex-col gap-4 border-l border-slate-200 pl-4">
      {logs.map((log) => (
        <li key={log.id} className="relative">
          <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-slate-400" />
          <p className="text-sm font-medium text-slate-800">{ACTION_LABELS[log.action] ?? log.action}</p>
          <p className="text-xs text-slate-400">
            {formatDateTime(log.createdAt)} · {log.actor ? `${log.actor.name} (${log.actor.role})` : 'System'}
            {showClaimId && ` · Claim ${log.claimId}`}
          </p>
          {log.metadata && Object.keys(log.metadata).length > 0 && (
            <p className="mt-0.5 truncate text-xs text-slate-400" title={JSON.stringify(log.metadata)}>
              {Object.entries(log.metadata)
                .map(([k, v]) => `${k}: ${v}`)
                .join(' · ')}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
