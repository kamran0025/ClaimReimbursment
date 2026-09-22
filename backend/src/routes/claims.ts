import { Router } from 'express';
import type { Request } from 'express';
import { ClaimStatus, Role } from '@prisma/client';
import { authenticate } from '../middleware/authenticate';
import { authorizeDecisionMaker } from '../middleware/authorize';
import { validateBody, validateQuery } from '../middleware/validate';
import { uploadReceipt } from '../middleware/upload';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../types/api';
import { ApiError, ErrorCode } from '../services/errors';
import {
  createClaimSchema,
  updateClaimSchema,
  claimItemSchema,
  submitClaimSchema,
  rejectClaimSchema,
  requestInfoSchema,
  respondInfoSchema,
  listClaimsQuerySchema,
} from '../validation/claimValidation';
import { listClaims, getClaimDetail } from '../services/claimQueryService';
import {
  createClaim,
  updateClaim,
  addItem,
  updateItem,
  deleteItem,
  submitClaim,
  resubmitClaim,
  cancelClaim,
  approveClaim,
  rejectClaim,
  requestInfo,
  respondToInfoRequest,
} from '../services/claimMutationService';
import { addReceipt, deleteReceipt, getReceiptForDownload } from '../services/receiptService';
import { listMessagesForClaim } from '../services/claimMessageService';

export const claimsRouter = Router();

claimsRouter.use(authenticate);

function scopeUser(req: Request) {
  return { id: req.user!.id, role: req.user!.role };
}

claimsRouter.get(
  '/',
  validateQuery(listClaimsQuerySchema),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as {
      status?: string | string[];
      claimantId?: string;
      assignedApproverId?: string;
      decidedById?: string;
      dateFrom?: string;
      dateTo?: string;
      amountMin?: number;
      amountMax?: number;
      search?: string;
      page?: number;
      pageSize?: number;
    };
    const status = q.status ? ((Array.isArray(q.status) ? q.status : [q.status]) as ClaimStatus[]) : undefined;
    const result = await listClaims(
      scopeUser(req),
      {
        status,
        claimantId: q.claimantId,
        assignedApproverId: q.assignedApproverId,
        decidedById: q.decidedById,
        dateFrom: q.dateFrom,
        dateTo: q.dateTo,
        amountMin: q.amountMin,
        amountMax: q.amountMax,
        search: q.search,
      },
      { page: q.page, pageSize: q.pageSize },
    );
    res.json(ok(result));
  }),
);

claimsRouter.post(
  '/',
  validateBody(createClaimSchema),
  asyncHandler(async (req, res) => {
    const result = await createClaim(scopeUser(req), req.body);
    res.status(201).json(ok(result));
  }),
);

claimsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await getClaimDetail(scopeUser(req), req.params.id);
    res.json(ok(result));
  }),
);

claimsRouter.patch(
  '/:id',
  validateBody(updateClaimSchema),
  asyncHandler(async (req, res) => {
    const result = await updateClaim(scopeUser(req), req.params.id, req.body);
    res.json(ok(result));
  }),
);

claimsRouter.post(
  '/:id/submit',
  validateBody(submitClaimSchema),
  asyncHandler(async (req, res) => {
    const result = await submitClaim(scopeUser(req), req.params.id, req.body.assignedApproverId);
    res.json(ok(result));
  }),
);

claimsRouter.post(
  '/:id/resubmit',
  validateBody(submitClaimSchema),
  asyncHandler(async (req, res) => {
    const result = await resubmitClaim(scopeUser(req), req.params.id, req.body.assignedApproverId);
    res.json(ok(result));
  }),
);

claimsRouter.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const result = await cancelClaim(scopeUser(req), req.params.id);
    res.json(ok(result));
  }),
);

// ---------------------------------------------------------------------------
// Line items
// ---------------------------------------------------------------------------
claimsRouter.post(
  '/:id/items',
  validateBody(claimItemSchema),
  asyncHandler(async (req, res) => {
    const result = await addItem(scopeUser(req), req.params.id, req.body);
    res.status(201).json(ok(result));
  }),
);

claimsRouter.patch(
  '/:id/items/:itemId',
  validateBody(claimItemSchema),
  asyncHandler(async (req, res) => {
    const result = await updateItem(scopeUser(req), req.params.id, req.params.itemId, req.body);
    res.json(ok(result));
  }),
);

claimsRouter.delete(
  '/:id/items/:itemId',
  asyncHandler(async (req, res) => {
    const result = await deleteItem(scopeUser(req), req.params.id, req.params.itemId);
    res.json(ok(result));
  }),
);

// ---------------------------------------------------------------------------
// Receipts
// ---------------------------------------------------------------------------
claimsRouter.post(
  '/:id/receipts',
  uploadReceipt,
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new ApiError(ErrorCode.VALIDATION_ERROR, 'A file is required.', { field: 'file' });
    }
    const claimItemId = typeof req.body?.claimItemId === 'string' && req.body.claimItemId.trim() ? req.body.claimItemId.trim() : null;
    const result = await addReceipt(scopeUser(req), req.params.id, req.file, claimItemId);
    res.status(201).json(ok(result));
  }),
);

claimsRouter.get(
  '/:id/receipts/:receiptId',
  asyncHandler(async (req, res) => {
    const file = await getReceiptForDownload(scopeUser(req), req.params.id, req.params.receiptId);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.fileName)}"`);
    res.send(file.buffer);
  }),
);

claimsRouter.delete(
  '/:id/receipts/:receiptId',
  asyncHandler(async (req, res) => {
    const result = await deleteReceipt(scopeUser(req), req.params.id, req.params.receiptId);
    res.json(ok(result));
  }),
);

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------
claimsRouter.post(
  '/:id/approve',
  authorizeDecisionMaker,
  asyncHandler(async (req, res) => {
    const result = await approveClaim({ id: req.user!.id, role: req.user!.role as Role }, req.params.id);
    res.json(ok(result));
  }),
);

claimsRouter.post(
  '/:id/reject',
  authorizeDecisionMaker,
  validateBody(rejectClaimSchema),
  asyncHandler(async (req, res) => {
    const result = await rejectClaim({ id: req.user!.id, role: req.user!.role as Role }, req.params.id, req.body.reason);
    res.json(ok(result));
  }),
);

claimsRouter.post(
  '/:id/request-info',
  authorizeDecisionMaker,
  validateBody(requestInfoSchema),
  asyncHandler(async (req, res) => {
    const result = await requestInfo({ id: req.user!.id, role: req.user!.role as Role }, req.params.id, req.body.message);
    res.json(ok(result));
  }),
);

claimsRouter.post(
  '/:id/respond-info',
  validateBody(respondInfoSchema),
  asyncHandler(async (req, res) => {
    const result = await respondToInfoRequest(scopeUser(req), req.params.id, req.body);
    res.json(ok(result));
  }),
);

claimsRouter.get(
  '/:id/messages',
  asyncHandler(async (req, res) => {
    const result = await listMessagesForClaim(scopeUser(req), req.params.id);
    res.json(ok(result));
  }),
);
