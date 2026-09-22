// Enums mirrored 1:1 from the backend Prisma schema (plan-backend.md §4, v2).
// Keeping these as string literal unions (not TS `enum`) so the values sent
// over the wire from a real backend (plain JSON strings) need zero mapping.

export const Role = {
  FINANCE: 'FINANCE',
  APPROVER: 'APPROVER',
  CLAIMANT: 'CLAIMANT',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

// v2: direct approver assignment replaces amount-tier routing. `SUBMITTED`
// is dropped (submit goes straight to PENDING_APPROVAL — there's no chain to
// build first); `INFO_REQUESTED` is added for the clarification workflow.
// `APPROVED` is terminal — this app does not track post-approval payout.
export const ClaimStatus = {
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  INFO_REQUESTED: 'INFO_REQUESTED',
  REJECTED: 'REJECTED',
  APPROVED: 'APPROVED',
  CANCELLED: 'CANCELLED',
} as const;
export type ClaimStatus = (typeof ClaimStatus)[keyof typeof ClaimStatus];

/** v2: a `ClaimMessage` is either an approver/Finance request for more info, or the claimant's reply. */
export const ClaimMessageType = {
  INFO_REQUEST: 'INFO_REQUEST',
  RESPONSE: 'RESPONSE',
} as const;
export type ClaimMessageType = (typeof ClaimMessageType)[keyof typeof ClaimMessageType];

// Reconstructed to cover every state-changing action in the v2 lifecycle so
// the audit trail has full coverage. `APPROVAL_STEP_*` actions are dropped
// with the multi-step chain; `CLAIM_INFO_REQUESTED`/`CLAIM_INFO_RESPONDED`
// are added for the new workflow. Extend here if the backend adds more.
export const AuditAction = {
  CLAIM_CREATED: 'CLAIM_CREATED',
  CLAIM_UPDATED: 'CLAIM_UPDATED',
  ITEM_ADDED: 'ITEM_ADDED',
  ITEM_UPDATED: 'ITEM_UPDATED',
  ITEM_DELETED: 'ITEM_DELETED',
  RECEIPT_UPLOADED: 'RECEIPT_UPLOADED',
  RECEIPT_DELETED: 'RECEIPT_DELETED',
  CLAIM_SUBMITTED: 'CLAIM_SUBMITTED',
  CLAIM_RESUBMITTED: 'CLAIM_RESUBMITTED',
  CLAIM_CANCELLED: 'CLAIM_CANCELLED',
  CLAIM_INFO_REQUESTED: 'CLAIM_INFO_REQUESTED',
  CLAIM_INFO_RESPONDED: 'CLAIM_INFO_RESPONDED',
  CLAIM_APPROVED: 'CLAIM_APPROVED',
  CLAIM_REJECTED: 'CLAIM_REJECTED',
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
  INFO_REQUESTED: 'Info Requested',
  REJECTED: 'Rejected',
  APPROVED: 'Approved',
  CANCELLED: 'Cancelled',
};
