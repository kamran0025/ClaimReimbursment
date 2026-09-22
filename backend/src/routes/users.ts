import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { asyncHandler } from '../utils/asyncHandler';
import { listActiveApprovers, listEmployees } from '../services/userService';
import { ok } from '../types/api';

export const usersRouter = Router();

usersRouter.use(authenticate);

usersRouter.get(
  '/approvers',
  asyncHandler(async (_req, res) => {
    res.json(ok(await listActiveApprovers()));
  }),
);

usersRouter.get(
  '/employees',
  authorize(Role.FINANCE),
  asyncHandler(async (_req, res) => {
    res.json(ok(await listEmployees()));
  }),
);
