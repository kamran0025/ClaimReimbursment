// Domain models mirrored from plan-backend.md §4 (Prisma schema summary, v2
// revision). Amounts are plain `number` here (rupees, 2dp) for simplicity in
// a frontend POC; a real backend would use Decimal/minor-units and this is
// the one place that mapping would need to be revisited.
import type {
  ClaimStatus,
  ClaimMessageType,
  Role,
  AuditAction,
} from './enums';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClaimItem {
  id: string;
  claimId: string;
  expenseDate: string; // ISO date
  category: string;
  description: string;
  amount: number;
  merchant?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Receipt {
  id: string;
  claimId: string;
  claimItemId: string | null;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedById: string;
  createdAt: string;
  /**
   * Mocks the backend's `storagePath` resolved to a fetchable URL. In this
   * POC it's a browser `URL.createObjectURL()` blob URL held in memory —
   * it does NOT survive a full page reload (no real disk/S3 storage exists
   * yet). A real backend would return a signed download URL here instead.
   */
  url: string;
}

export interface ClaimMessage {
  id: string;
  claimId: string;
  senderId: string;
  type: ClaimMessageType;
  message: string;
  attachedReceiptId: string | null;
  createdAt: string;
  // Denormalized for display convenience (a real API would `include` this).
  sender?: Pick<User, 'id' | 'name' | 'email' | 'role'>;
  attachedReceipt?: Receipt | null;
}

export interface AuditLog {
  id: string;
  claimId: string;
  actorId: string | null;
  action: AuditAction;
  oldStatus: ClaimStatus | null;
  newStatus: ClaimStatus | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  // Denormalized for display convenience.
  actor?: Pick<User, 'id' | 'name' | 'email' | 'role'> | null;
}

export interface Claim {
  id: string;
  claimantId: string;
  title: string;
  status: ClaimStatus;
  total: number;
  /** Chosen by the claimant at submit/resubmit time; null until first submission. */
  assignedApproverId: string | null;
  /** Whoever (the assigned approver, or Finance) approved/rejected this submission cycle. */
  decidedById: string | null;
  decidedAt: string | null;
  submissionCycle: number;
  rejectionReason: string | null;
  rejectedById: string | null;
  rejectedAt: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Denormalized for display convenience.
  claimant?: Pick<User, 'id' | 'name' | 'email'>;
  assignedApprover?: Pick<User, 'id' | 'name' | 'email'> | null;
  decidedBy?: Pick<User, 'id' | 'name' | 'email'> | null;
}

// Composite shape returned by the "get claim detail" endpoint.
export interface ClaimDetail extends Claim {
  items: ClaimItem[];
  receipts: Receipt[];
  messages: ClaimMessage[];
}
