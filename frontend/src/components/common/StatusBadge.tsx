import { Badge } from '@/components/ui/Badge';
import type { BadgeColor } from '@/components/ui/Badge';
import { ClaimStatus, CLAIM_STATUS_LABELS } from '@/types/enums';

const CLAIM_STATUS_COLOR: Record<ClaimStatus, BadgeColor> = {
  DRAFT: 'slate',
  PENDING_APPROVAL: 'amber',
  INFO_REQUESTED: 'orange',
  REJECTED: 'red',
  APPROVED: 'green',
  CANCELLED: 'gray',
};

export function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  return <Badge color={CLAIM_STATUS_COLOR[status]}>{CLAIM_STATUS_LABELS[status]}</Badge>;
}
