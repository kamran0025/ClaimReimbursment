import type { ClaimDetail } from '@/types/models';
import { ClaimStatusBadge } from '@/components/common/StatusBadge';
import { formatDate, formatInr } from '@/utils/format';
import { Card, CardBody } from '@/components/ui/Card';

export function ClaimSummaryCard({ claim, showClaimant }: { claim: ClaimDetail; showClaimant?: boolean }) {
  return (
    <Card>
      <CardBody>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900">{claim.title}</h2>
              <ClaimStatusBadge status={claim.status} />
            </div>
            {showClaimant && claim.claimant && (
              <p className="mt-1 text-sm text-slate-500">
                {claim.claimant.name} · {claim.claimant.email}
              </p>
            )}
          </div>
          <p className="text-2xl font-bold text-slate-900">{formatInr(claim.total)}</p>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs uppercase text-slate-400">Created</dt>
            <dd className="text-slate-700">{formatDate(claim.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-400">Submitted</dt>
            <dd className="text-slate-700">{formatDate(claim.submittedAt)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-400">Assigned approver</dt>
            <dd className="text-slate-700">{claim.assignedApprover?.name ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-400">Submission cycle</dt>
            <dd className="text-slate-700">#{claim.submissionCycle}</dd>
          </div>
        </dl>

        {claim.decidedBy && (claim.status === 'APPROVED' || claim.status === 'REJECTED') && (
          <p className="mt-3 text-xs text-slate-400">
            Decided by {claim.decidedBy.name} · {formatDate(claim.decidedAt)}
          </p>
        )}

        {claim.status === 'INFO_REQUESTED' && (
          <div className="mt-4 rounded-md border border-orange-200 bg-orange-50 px-3 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Information requested</p>
            <p className="mt-0.5 text-sm text-orange-800">See the message thread below for details.</p>
          </div>
        )}

        {claim.status === 'REJECTED' && claim.rejectionReason && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-500">Rejection reason</p>
            <p className="mt-0.5 text-sm text-red-800">{claim.rejectionReason}</p>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
