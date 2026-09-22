// Maps Prisma models to the exact JSON shapes frontend/src/types/models.ts
// expects (amounts as `number`, dates as ISO strings, relations picked down
// to {id,name,email[,role]}).
import type { AuditLog, Claim, ClaimItem, ClaimMessage, Receipt, User } from '@prisma/client';

export type PickedUser = Pick<User, 'id' | 'name' | 'email'>;
export type PickedUserWithRole = Pick<User, 'id' | 'name' | 'email' | 'role'>;

export function serializeUser(user: User) {
  const { passwordHash, ...rest } = user;
  void passwordHash;
  return { ...rest, createdAt: rest.createdAt.toISOString(), updatedAt: rest.updatedAt.toISOString() };
}

export function pickUser(user: User | null | undefined): PickedUser | null {
  if (!user) return null;
  return { id: user.id, name: user.name, email: user.email };
}

export function pickUserWithRole(user: User | null | undefined): PickedUserWithRole | null {
  if (!user) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

type ClaimWithRelations = Claim & {
  claimant?: User | null;
  assignedApprover?: User | null;
  decidedBy?: User | null;
};

export function serializeClaim(claim: ClaimWithRelations) {
  return {
    id: claim.id,
    claimantId: claim.claimantId,
    title: claim.title,
    status: claim.status,
    total: Number(claim.total),
    assignedApproverId: claim.assignedApproverId,
    decidedById: claim.decidedById,
    decidedAt: claim.decidedAt ? claim.decidedAt.toISOString() : null,
    submissionCycle: claim.submissionCycle,
    rejectionReason: claim.rejectionReason,
    rejectedById: claim.rejectedById,
    rejectedAt: claim.rejectedAt ? claim.rejectedAt.toISOString() : null,
    submittedAt: claim.submittedAt ? claim.submittedAt.toISOString() : null,
    createdAt: claim.createdAt.toISOString(),
    updatedAt: claim.updatedAt.toISOString(),
    claimant: claim.claimant ? pickUser(claim.claimant) ?? undefined : undefined,
    assignedApprover: 'assignedApprover' in claim ? pickUser(claim.assignedApprover) : undefined,
    decidedBy: 'decidedBy' in claim ? pickUser(claim.decidedBy) : undefined,
  };
}

export function serializeClaimItem(item: ClaimItem) {
  return {
    id: item.id,
    claimId: item.claimId,
    expenseDate: item.expenseDate.toISOString(),
    category: item.category,
    description: item.description,
    amount: Number(item.amount),
    merchant: item.merchant ?? undefined,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export function serializeReceipt(receipt: Receipt) {
  return {
    id: receipt.id,
    claimId: receipt.claimId,
    claimItemId: receipt.claimItemId,
    fileName: receipt.fileName,
    mimeType: receipt.mimeType,
    fileSize: receipt.fileSize,
    uploadedById: receipt.uploadedById,
    createdAt: receipt.createdAt.toISOString(),
    url: `/claims/${receipt.claimId}/receipts/${receipt.id}`,
  };
}

type MessageWithRelations = ClaimMessage & { sender?: User | null; attachedReceipt?: Receipt | null };

export function serializeMessage(message: MessageWithRelations) {
  return {
    id: message.id,
    claimId: message.claimId,
    senderId: message.senderId,
    type: message.type,
    message: message.message,
    attachedReceiptId: message.attachedReceiptId,
    createdAt: message.createdAt.toISOString(),
    sender: message.sender ? pickUserWithRole(message.sender) ?? undefined : undefined,
    attachedReceipt: message.attachedReceipt ? serializeReceipt(message.attachedReceipt) : message.attachedReceiptId ? undefined : null,
  };
}

type AuditWithRelations = AuditLog & { actor?: User | null };

export function serializeAudit(log: AuditWithRelations) {
  return {
    id: log.id,
    claimId: log.claimId,
    actorId: log.actorId,
    action: log.action,
    oldStatus: log.oldStatus,
    newStatus: log.newStatus,
    metadata: log.metadata,
    createdAt: log.createdAt.toISOString(),
    actor: log.actorId ? pickUserWithRole(log.actor) : null,
  };
}
