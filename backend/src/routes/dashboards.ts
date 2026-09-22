import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../types/api';
import { getApproverDashboard, getClaimantDashboard, getFinanceDashboard } from '../services/dashboardService';

export const dashboardsRouter = Router();

dashboardsRouter.use(authenticate);

dashboardsRouter.get(
  '/claimant',
  authorize(Role.CLAIMANT),
  asyncHandler(async (req, res) => {
    res.json(ok(await getClaimantDashboard(req.user!.id)));
  }),
);

dashboardsRouter.get(
  '/approver',
  authorize(Role.APPROVER),
  asyncHandler(async (req, res) => {
    res.json(ok(await getApproverDashboard(req.user!.id)));
  }),
);

dashboardsRouter.get(
  '/finance',
  authorize(Role.FINANCE),
  asyncHandler(async (req, res) => {
    res.json(ok(await getFinanceDashboard()));
  }),
);
