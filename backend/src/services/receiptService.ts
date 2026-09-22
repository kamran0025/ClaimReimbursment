// Receipt upload/download/delete — plan-backend.md §6/§7. Uploads are
// validated server-side (mime + size), written through the `Storage`
// abstraction, and read back only via an authenticated, scoped download —
// never served as static files.
import { ClaimStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { env } from '../lib/env';
import { ApiError, ErrorCode } from './errors';
import { assertClaimInScope, assertOwner, type ScopeUser } from './claimScope';
import { assertEditable } from './claimStateMachine';
import { recordAudit } from './auditLogService';
import { buildClaimDetail, loadClaimForMutation } from './claimQueryService';
import { isAllowedReceiptMimeType } from './receiptRules';
import { storage } from './storage';

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

function validateReceiptFile(file: UploadedFile): void {
  if (!isAllowedReceiptMimeType(file.mimetype)) {
    throw new ApiError(ErrorCode.VALIDATION_ERROR, 'Only JPEG, PNG, WEBP images or PDF files are allowed.', { field: 'file' });
  }
  if (file.size <= 0 || file.size > env.maxReceiptSizeBytes) {
    throw new ApiError(ErrorCode.VALIDATION_ERROR, `File must be ${Math.floor(env.maxReceiptSizeBytes / (1024 * 1024))}MB or smaller.`, {
      field: 'file',
    });
  }
}

export async function addReceipt(user: ScopeUser, claimId: string, file: UploadedFile, claimItemId: string | null) {
  validateReceiptFile(file);

  const claim = await prisma.claim.findUnique({ where: { id: claimId } });
  if (!claim) throw new ApiError(ErrorCode.CLAIM_NOT_FOUND, 'Claim not found.');
  assertOwner(user, claim);

  if (claim.status === ClaimStatus.INFO_REQUESTED) {
    // While INFO_REQUESTED, existing line items are locked — only a new,
    // unattached "additional evidence" receipt may be added (plan-backend.md §5).
    if (claimItemId) {
      throw new ApiError(ErrorCode.CLAIM_NOT_EDITABLE, 'Existing line items cannot be changed while responding to an info request.');
    }
  } else {
    assertEditable(claim);
  }

  if (claimItemId) {
    const item = await prisma.claimItem.findFirst({ where: { id: claimItemId, claimId } });
    if (!item) throw new ApiError(ErrorCode.ITEM_NOT_FOUND, 'Line item not found.');
  }

  const stored = await storage.save(file.buffer, file.originalname);
  await prisma.$transaction(async (tx) => {
    const receipt = await tx.receipt.create({
      data: {
        claimId,
        claimItemId,
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        storagePath: stored.storagePath,
        uploadedById: user.id,
      },
    });
    await recordAudit(tx, {
      claimId,
      actorId: user.id,
      action: 'RECEIPT_UPLOADED',
      oldStatus: claim.status,
      newStatus: claim.status,
      metadata: { fileName: receipt.fileName, claimItemId },
    });
  });

  return buildClaimDetail(await loadClaimForMutation(claimId));
}

export async function deleteReceipt(user: ScopeUser, claimId: string, receiptId: string) {
  const claim = await prisma.claim.findUnique({ where: { id: claimId } });
  if (!claim) throw new ApiError(ErrorCode.CLAIM_NOT_FOUND, 'Claim not found.');
  assertOwner(user, claim);

  const receipt = await prisma.receipt.findFirst({ where: { id: receiptId, claimId } });
  if (!receipt) throw new ApiError(ErrorCode.RECEIPT_NOT_FOUND, 'Receipt not found.');

  if (claim.status === ClaimStatus.INFO_REQUESTED) {
    if (receipt.claimItemId) {
      throw new ApiError(ErrorCode.CLAIM_NOT_EDITABLE, 'Existing line items cannot be changed while responding to an info request.');
    }
  } else {
    assertEditable(claim);
  }

  await prisma.$transaction(async (tx) => {
    await tx.receipt.delete({ where: { id: receiptId } });
    await recordAudit(tx, {
      claimId,
      actorId: user.id,
      action: 'RECEIPT_DELETED',
      oldStatus: claim.status,
      newStatus: claim.status,
      metadata: { receiptId },
    });
  });
  await storage.delete(receipt.storagePath);

  return buildClaimDetail(await loadClaimForMutation(claimId));
}

export interface DownloadableReceipt {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}

export async function getReceiptForDownload(user: ScopeUser, claimId: string, receiptId: string): Promise<DownloadableReceipt> {
  const claim = await prisma.claim.findUnique({ where: { id: claimId } });
  if (!claim) throw new ApiError(ErrorCode.CLAIM_NOT_FOUND, 'Claim not found.');
  assertClaimInScope(user, claim);

  const receipt = await prisma.receipt.findFirst({ where: { id: receiptId, claimId } });
  if (!receipt) throw new ApiError(ErrorCode.RECEIPT_NOT_FOUND, 'Receipt not found.');

  const buffer = await storage.read(receipt.storagePath);
  return { buffer, mimeType: receipt.mimeType, fileName: receipt.fileName };
}
