import { Router } from 'express';
import { ClaimStatus, Role } from '@prisma/client';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { asyncHandler } from '../utils/asyncHandler';
import { streamClaimsCsv, exportFilename } from '../services/exportService';
import { runApprovalReminders } from '../services/approvalReminderService';
import { ok } from '../types/api';

export const financeRouter = Router();

financeRouter.use(authenticate, authorize(Role.FINANCE));

financeRouter.get(
  '/export',
  asyncHandler(async (req, res) => {
    const { dateFrom, dateTo, status } = req.query as Record<string, string | string[] | undefined>;
    const statusFilter = status ? ((Array.isArray(status) ? status : [status]) as ClaimStatus[]) : undefined;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${exportFilename()}"`);

    for await (const line of streamClaimsCsv(
      { id: req.user!.id, role: req.user!.role },
      { dateFrom: dateFrom as string | undefined, dateTo: dateTo as string | undefined, status: statusFilter },
    )) {
      res.write(`${line}\n`);
    }
    res.end();
  }),
);

// Runs the approval-reminder job now instead of waiting for the schedule.
// Safe to call repeatedly: claims already reminded in the current window are skipped.
financeRouter.post(
  '/reminders/run',
  asyncHandler(async (_req, res) => {
    res.json(ok(await runApprovalReminders()));
  }),
);
