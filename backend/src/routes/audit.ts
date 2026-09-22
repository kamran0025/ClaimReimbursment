import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../types/api';
import { assertClaimInScope } from '../services/claimScope';
import { ApiError, ErrorCode } from '../services/errors';
import { prisma } from '../lib/prisma';
import { listAllAudit, listAuditForClaim } from '../services/auditLogService';

export const auditRouter = Router();

auditRouter.use(authenticate);

auditRouter.get(
  '/claims/:claimId',
  asyncHandler(async (req, res) => {
    const claim = await prisma.claim.findUnique({ where: { id: req.params.claimId } });
    if (!claim) throw new ApiError(ErrorCode.CLAIM_NOT_FOUND, 'Claim not found.');
    assertClaimInScope({ id: req.user!.id, role: req.user!.role }, claim);
    res.json(ok(await listAuditForClaim(req.params.claimId)));
  }),
);

auditRouter.get(
  '/',
  authorize(Role.FINANCE),
  asyncHandler(async (req, res) => {
    const { claimId, action, page, pageSize } = req.query as Record<string, string | undefined>;
    const result = await listAllAudit(
      { claimId, action },
      { page: page ? Number(page) : undefined, pageSize: pageSize ? Number(pageSize) : undefined },
    );
    res.json(ok(result));
  }),
);
