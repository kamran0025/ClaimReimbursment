import { useState } from 'react';
import type { ReactNode } from 'react';
import clsx from 'clsx';
import type { ClaimDetail } from '@/types/models';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ClaimSummaryCard } from './ClaimSummaryCard';
import { ClaimItemsTable } from './ClaimItemsTable';
import { ReceiptsList } from './ReceiptsList';
import { ClaimMessagesPanel, getMessagingCapability } from './ClaimMessagesPanel';
import { AuditTrail } from '@/features/audit/components/AuditTrail';
import { useClaimAudit } from '@/features/audit/hooks/useAudit';
import { PageSpinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/common/ErrorState';
import { useAuth } from '@/app/AuthContext';

const MESSAGES_BUTTON_LABEL = {
  requestInfo: 'Ask for More Info',
  respond: 'Send a Message',
  view: 'View Messages',
} as const;

/**
 * Full read-only claim view shared by claimant/approver/finance detail pages.
 * Role-specific actions (approve/reject, edit link) are passed in as
 * `actions`. The messages thread — and, for whoever can currently act on the
 * claim, the reply box to send the next message — lives in a toggleable side
 * panel rather than a stacked card, so replying stays on the same screen. The
 * toggle button's label names the actual action available (e.g. "Ask for
 * More Info") rather than a generic "Show Messages", so it's obvious this is
 * where to go.
 */
export function ClaimDetailView({ claim, showClaimant, actions }: { claim: ClaimDetail; showClaimant?: boolean; actions?: ReactNode }) {
  const { user } = useAuth();
  const { data: auditLogs, isLoading: auditLoading, isError: auditError, error, refetch } = useClaimAudit(claim.id);
  const additionalReceipts = claim.receipts.filter((r) => !r.claimItemId);
  const [showMessages, setShowMessages] = useState(() => claim.messages.length > 0);
  // How many messages had been seen as of the last open/close toggle, so the badge counts only
  // new ones — marked seen on every toggle, and suppressed outright while the panel is open
  // (the thread is on screen, so nothing currently in it can be "unseen").
  const [seenCount, setSeenCount] = useState(() => claim.messages.length);
  const toggleMessages = () => {
    setSeenCount(claim.messages.length);
    setShowMessages((v) => !v);
  };
  const closeMessages = () => {
    setSeenCount(claim.messages.length);
    setShowMessages(false);
  };
  const newMessageCount = showMessages ? 0 : Math.max(0, claim.messages.length - seenCount);
  const capability = getMessagingCapability(claim, user);
  const messagesButtonLabel = showMessages ? 'Hide Messages' : MESSAGES_BUTTON_LABEL[capability];
  const messagesButtonEmphasized = !showMessages && capability !== 'view';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant={messagesButtonEmphasized ? 'primary' : 'outline'} onClick={toggleMessages}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4 shrink-0">
            <path d="M3.5 2A2.5 2.5 0 0 0 1 4.5v5A2.5 2.5 0 0 0 3.5 12h.5v2.1a.5.5 0 0 0 .8.4L8.13 12H12.5A2.5 2.5 0 0 0 15 9.5v-5A2.5 2.5 0 0 0 12.5 2h-9Z" />
          </svg>
          {messagesButtonLabel}
          {newMessageCount > 0 && (
            <Badge color="orange" className="ml-0.5">
              {newMessageCount}
            </Badge>
          )}
        </Button>
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      </div>

      <div className={clsx('grid grid-cols-1 items-start gap-4', showMessages && 'lg:grid-cols-2')}>
        <div className="flex min-w-0 flex-col gap-4">
          <ClaimSummaryCard claim={claim} showClaimant={showClaimant} />

          <Card>
            <CardHeader title="Line items" />
            <CardBody>
              <ClaimItemsTable items={claim.items} receipts={claim.receipts} total={claim.total} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Additional receipts" subtitle="Attached outside a specific line item — for example, in response to an info request." />
            <CardBody>
              <ReceiptsList receipts={additionalReceipts} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Audit history" />
            <CardBody>
              {auditLoading && <PageSpinner label="Loading history…" />}
              {auditError && <ErrorState error={error} onRetry={() => refetch()} />}
              {auditLogs && <AuditTrail logs={auditLogs} />}
            </CardBody>
          </Card>
        </div>

        {showMessages && (
          <div className="min-w-0">
            <ClaimMessagesPanel claim={claim} onClose={closeMessages} />
          </div>
        )}
      </div>
    </div>
  );
}
