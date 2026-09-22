// Claim CRUD, line items, submit/resubmit/cancel, and the direct
// approve/reject/request-info/respond-info decision actions —
// plan-backend.md §5-§8. Ported 1:1 from
// frontend/src/services/api/claimsService.ts's business rules (ownership,
// state-machine guards, server-side total recalculation, mandatory
// non-empty submission, approver assignment, mandatory rejection/info
// messages) — the mock this backend replaces implemented exactly this logic
// in memory; here every mutation runs inside a `prisma.$transaction`
// (plan-backend.md §8) and every status change is paired with an audit row.
import { ClaimMessageType, ClaimStatus, Prisma, Role, type Claim } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError, ErrorCode } from './errors';
import { assertOwner, type ScopeUser } from './claimScope';
import {
  assertCancellable,
  assertDecidable,
  assertEditable,
  assertRespondable,
  assertSubmittable,
} from './claimStateMachine';
import { recalculateClaimTotal } from './claimTotalService';
import { recordAudit } from './auditLogService';
import { buildClaimDetail, loadClaimForMutation } from './claimQueryService';
import { storage } from './storage';
import type { CreateClaimInput, UpdateClaimInput, ClaimItemInput, RespondInfoInput } from '../validation/claimValidation';

async function requireClaimForOwner(tx: Prisma.TransactionClient, user: ScopeUser, claimId: string): Promise<Claim> {
  const claim = await tx.claim.findUnique({ where: { id: claimId } });
  if (!claim) throw new ApiError(ErrorCode.CLAIM_NOT_FOUND, 'Claim not found.');
  assertOwner(user, claim);
  return claim;
}

export async function createClaim(user: ScopeUser, input: CreateClaimInput) {
  if (user.role !== Role.CLAIMANT) {
    throw new ApiError(ErrorCode.FORBIDDEN_ROLE, 'This action requires the CLAIMANT role.');
  }
  const claim = await prisma.$transaction(async (tx) => {
    const created = await tx.claim.create({
      data: { claimantId: user.id, title: input.title, status: ClaimStatus.DRAFT, submissionCycle: 1 },
    });
    await recordAudit(tx, {
      claimId: created.id,
      actorId: user.id,
      action: 'CLAIM_CREATED',
      oldStatus: null,
      newStatus: ClaimStatus.DRAFT,
      metadata: { title: created.title },
    });
    return created;
  });
  return buildClaimDetail(await loadClaimForMutation(claim.id));
}

export async function updateClaim(user: ScopeUser, claimId: string, input: UpdateClaimInput) {
  await prisma.$transaction(async (tx) => {
    const claim = await requireClaimForOwner(tx, user, claimId);
    assertEditable(claim);
    if (input.title != null) {
      await tx.claim.update({ where: { id: claimId }, data: { title: input.title } });
    }
    await recordAudit(tx, {
      claimId,
      actorId: user.id,
      action: 'CLAIM_UPDATED',
      oldStatus: claim.status,
      newStatus: claim.status,
      metadata: input,
    });
  });
  return buildClaimDetail(await loadClaimForMutation(claimId));
}

function validateItemInput(input: ClaimItemInput): void {
  const parsed = Date.parse(input.expenseDate);
  if (!input.expenseDate || Number.isNaN(parsed)) {
    throw new ApiError(ErrorCode.VALIDATION_ERROR, 'A valid expense date is required.', { field: 'expenseDate' });
  }
  if (parsed > Date.now() + 24 * 60 * 60 * 1000) {
    throw new ApiError(ErrorCode.VALIDATION_ERROR, 'Expense date cannot be in the future.', { field: 'expenseDate' });
  }
  if (!input.category.trim()) {
    throw new ApiError(ErrorCode.VALIDATION_ERROR, 'Category is required.', { field: 'category' });
  }
  if (!input.description.trim()) {
    throw new ApiError(ErrorCode.VALIDATION_ERROR, 'Description is required.', { field: 'description' });
  }
  if (!(input.amount > 0)) {
    throw new ApiError(ErrorCode.VALIDATION_ERROR, 'Amount must be greater than zero.', { field: 'amount' });
  }
}

export async function addItem(user: ScopeUser, claimId: string, input: ClaimItemInput) {
  validateItemInput(input);
  await prisma.$transaction(async (tx) => {
    const claim = await requireClaimForOwner(tx, user, claimId);
    assertEditable(claim);
    const item = await tx.claimItem.create({
      data: {
        claimId,
        expenseDate: new Date(input.expenseDate),
        category: input.category.trim(),
        description: input.description.trim(),
        amount: input.amount,
        merchant: input.merchant?.trim() || null,
      },
    });
    await recalculateClaimTotal(tx, claimId);
    await recordAudit(tx, {
      claimId,
      actorId: user.id,
      action: 'ITEM_ADDED',
      oldStatus: claim.status,
      newStatus: claim.status,
      metadata: { itemId: item.id, amount: input.amount },
    });
  });
  return buildClaimDetail(await loadClaimForMutation(claimId));
}

export async function updateItem(user: ScopeUser, claimId: string, itemId: string, input: ClaimItemInput) {
  validateItemInput(input);
  await prisma.$transaction(async (tx) => {
    const claim = await requireClaimForOwner(tx, user, claimId);
    assertEditable(claim);
    const existing = await tx.claimItem.findFirst({ where: { id: itemId, claimId } });
    if (!existing) throw new ApiError(ErrorCode.ITEM_NOT_FOUND, 'Line item not found.');
    await tx.claimItem.update({
      where: { id: itemId },
      data: {
        expenseDate: new Date(input.expenseDate),
        category: input.category.trim(),
        description: input.description.trim(),
        amount: input.amount,
        merchant: input.merchant?.trim() || null,
      },
    });
    await recalculateClaimTotal(tx, claimId);
    await recordAudit(tx, {
      claimId,
      actorId: user.id,
      action: 'ITEM_UPDATED',
      oldStatus: claim.status,
      newStatus: claim.status,
      metadata: { itemId },
    });
  });
  return buildClaimDetail(await loadClaimForMutation(claimId));
}

export async function deleteItem(user: ScopeUser, claimId: string, itemId: string) {
  const orphanedStoragePaths = await prisma.$transaction(async (tx) => {
    const claim = await requireClaimForOwner(tx, user, claimId);
    assertEditable(claim);
    const existing = await tx.claimItem.findFirst({ where: { id: itemId, claimId } });
    if (!existing) throw new ApiError(ErrorCode.ITEM_NOT_FOUND, 'Line item not found.');

    // Any receipt attached to this item goes with it.
    const attachedReceipts = await tx.receipt.findMany({ where: { claimId, claimItemId: itemId } });
    if (attachedReceipts.length > 0) {
      await tx.receipt.deleteMany({ where: { id: { in: attachedReceipts.map((r) => r.id) } } });
    }
    await tx.claimItem.delete({ where: { id: itemId } });
    await recalculateClaimTotal(tx, claimId);
    await recordAudit(tx, {
      claimId,
      actorId: user.id,
      action: 'ITEM_DELETED',
      oldStatus: claim.status,
      newStatus: claim.status,
      metadata: { itemId },
    });
    return attachedReceipts.map((r) => r.storagePath);
  });

  await Promise.all(orphanedStoragePaths.map((p) => storage.delete(p)));
  return buildClaimDetail(await loadClaimForMutation(claimId));
}

async function runSubmission(user: ScopeUser, claimId: string, isResubmit: boolean, assignedApproverId: string) {
  await prisma.$transaction(async (tx) => {
    const claim = await requireClaimForOwner(tx, user, claimId);
    assertSubmittable(claim);

    const approver = await tx.user.findUnique({ where: { id: assignedApproverId } });
    if (!approver || approver.role !== Role.APPROVER || !approver.isActive) {
      throw new ApiError(ErrorCode.VALIDATION_ERROR, 'Select a valid, active approver.', { field: 'assignedApproverId' });
    }

    const items = await tx.claimItem.findMany({ where: { claimId } });
    if (items.length === 0) {
      throw new ApiError(ErrorCode.CLAIM_EMPTY_ITEMS, 'Add at least one line item before submitting.');
    }
    if (items.some((i) => !(Number(i.amount) > 0))) {
      throw new ApiError(ErrorCode.VALIDATION_ERROR, 'All line items must have a positive amount.');
    }

    const total = await recalculateClaimTotal(tx, claimId);

    const nextCycle = isResubmit ? claim.submissionCycle + 1 : claim.submissionCycle;
    await tx.claim.update({
      where: { id: claimId },
      data: {
        status: ClaimStatus.PENDING_APPROVAL,
        assignedApproverId,
        decidedById: null,
        decidedAt: null,
        submissionCycle: nextCycle,
        submittedAt: new Date(),
        rejectionReason: null,
        rejectedById: null,
        rejectedAt: null,
      },
    });

    await recordAudit(tx, {
      claimId,
      actorId: user.id,
      action: isResubmit ? 'CLAIM_RESUBMITTED' : 'CLAIM_SUBMITTED',
      oldStatus: claim.status,
      newStatus: ClaimStatus.PENDING_APPROVAL,
      metadata: { total: Number(total), submissionCycle: nextCycle, assignedApproverId },
    });
  });
  return buildClaimDetail(await loadClaimForMutation(claimId));
}

export function submitClaim(user: ScopeUser, claimId: string, assignedApproverId: string) {
  return runSubmission(user, claimId, false, assignedApproverId);
}

export function resubmitClaim(user: ScopeUser, claimId: string, assignedApproverId: string) {
  return runSubmission(user, claimId, true, assignedApproverId);
}

export async function cancelClaim(user: ScopeUser, claimId: string) {
  await prisma.$transaction(async (tx) => {
    const claim = await requireClaimForOwner(tx, user, claimId);
    assertCancellable(claim);
    await tx.claim.update({ where: { id: claimId }, data: { status: ClaimStatus.CANCELLED } });
    await recordAudit(tx, {
      claimId,
      actorId: user.id,
      action: 'CLAIM_CANCELLED',
      oldStatus: claim.status,
      newStatus: ClaimStatus.CANCELLED,
    });
  });
  return buildClaimDetail(await loadClaimForMutation(claimId));
}

// ---------------------------------------------------------------------------
// Decisions — approve / reject / request-info (assigned approver OR Finance),
// and respond-info (claimant only). Whoever decides first wins: the claim
// leaves PENDING_APPROVAL/INFO_REQUESTED inside the same transaction that
// reads it, so a concurrent second decision on the same claim simply fails
// `assertDecidable` against the now-decided status once its transaction reads
// the row (normal transaction isolation on the row update — plan-backend.md §5).
// ---------------------------------------------------------------------------
export async function approveClaim(user: { id: string; role: Role }, claimId: string) {
  await prisma.$transaction(async (tx) => {
    const claim = await tx.claim.findUnique({ where: { id: claimId } });
    if (!claim) throw new ApiError(ErrorCode.CLAIM_NOT_FOUND, 'Claim not found.');
    assertDecidable(claim, user);

    await tx.claim.update({
      where: { id: claimId },
      data: { status: ClaimStatus.APPROVED, decidedById: user.id, decidedAt: new Date() },
    });
    await recordAudit(tx, {
      claimId,
      actorId: user.id,
      action: 'CLAIM_APPROVED',
      oldStatus: claim.status,
      newStatus: ClaimStatus.APPROVED,
    });
  });
  return buildClaimDetail(await loadClaimForMutation(claimId));
}

export async function rejectClaim(user: { id: string; role: Role }, claimId: string, reason: string) {
  if (!reason.trim()) {
    throw new ApiError(ErrorCode.REJECTION_REASON_REQUIRED, 'A rejection reason is required.', { field: 'reason' });
  }
  await prisma.$transaction(async (tx) => {
    const claim = await tx.claim.findUnique({ where: { id: claimId } });
    if (!claim) throw new ApiError(ErrorCode.CLAIM_NOT_FOUND, 'Claim not found.');
    assertDecidable(claim, user);

    const now = new Date();
    await tx.claim.update({
      where: { id: claimId },
      data: {
        status: ClaimStatus.REJECTED,
        decidedById: user.id,
        decidedAt: now,
        rejectionReason: reason.trim(),
        rejectedById: user.id,
        rejectedAt: now,
      },
    });
    await recordAudit(tx, {
      claimId,
      actorId: user.id,
      action: 'CLAIM_REJECTED',
      oldStatus: claim.status,
      newStatus: ClaimStatus.REJECTED,
      metadata: { reason: reason.trim() },
    });
  });
  return buildClaimDetail(await loadClaimForMutation(claimId));
}

export async function requestInfo(user: { id: string; role: Role }, claimId: string, message: string) {
  if (!message.trim()) {
    throw new ApiError(ErrorCode.INFO_REQUEST_MESSAGE_REQUIRED, 'A message is required to request more information.', { field: 'message' });
  }
  await prisma.$transaction(async (tx) => {
    const claim = await tx.claim.findUnique({ where: { id: claimId } });
    if (!claim) throw new ApiError(ErrorCode.CLAIM_NOT_FOUND, 'Claim not found.');
    assertDecidable(claim, user);

    await tx.claim.update({ where: { id: claimId }, data: { status: ClaimStatus.INFO_REQUESTED } });
    await tx.claimMessage.create({
      data: { claimId, senderId: user.id, type: ClaimMessageType.INFO_REQUEST, message: message.trim() },
    });
    await recordAudit(tx, {
      claimId,
      actorId: user.id,
      action: 'CLAIM_INFO_REQUESTED',
      oldStatus: claim.status,
      newStatus: ClaimStatus.INFO_REQUESTED,
      metadata: { message: message.trim() },
    });
  });
  return buildClaimDetail(await loadClaimForMutation(claimId));
}

export async function respondToInfoRequest(user: ScopeUser, claimId: string, input: RespondInfoInput) {
  if (!input.message.trim()) {
    throw new ApiError(ErrorCode.INFO_RESPONSE_MESSAGE_REQUIRED, 'A response message is required.', { field: 'message' });
  }
  await prisma.$transaction(async (tx) => {
    const claim = await tx.claim.findUnique({ where: { id: claimId } });
    if (!claim) throw new ApiError(ErrorCode.CLAIM_NOT_FOUND, 'Claim not found.');
    assertRespondable(claim, user);

    let attachedReceiptId: string | null = null;
    if (input.attachedReceiptId) {
      const receipt = await tx.receipt.findFirst({ where: { id: input.attachedReceiptId, claimId } });
      if (!receipt) throw new ApiError(ErrorCode.RECEIPT_NOT_FOUND, 'Receipt not found.');
      attachedReceiptId = receipt.id;
    }

    const newStatus = claim.status === ClaimStatus.INFO_REQUESTED ? ClaimStatus.PENDING_APPROVAL : claim.status;
    await tx.claim.update({ where: { id: claimId }, data: { status: newStatus } });
    await tx.claimMessage.create({
      data: { claimId, senderId: user.id, type: ClaimMessageType.RESPONSE, message: input.message.trim(), attachedReceiptId },
    });
    await recordAudit(tx, {
      claimId,
      actorId: user.id,
      action: 'CLAIM_INFO_RESPONDED',
      oldStatus: claim.status,
      newStatus,
    });
  });
  return buildClaimDetail(await loadClaimForMutation(claimId));
}
