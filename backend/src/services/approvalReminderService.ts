// Approval reminders — nudges whoever a claim is waiting on when it has sat
// in their queue too long without a decision:
//   PENDING_APPROVAL         → the assigned approver (or Finance, if that
//                              approver has since been deactivated)
//   PENDING_FINANCE_APPROVAL → every active Finance user
// INFO_REQUESTED is waiting on the claimant, so it never triggers a reminder.
//
// "Waiting since" is `Claim.assignedAt`, which every mutation that hands the
// claim to a reviewer resets via `startReviewClock()`. The first reminder goes
// out `firstAfterDays` after that, then one every `repeatEveryDays` until the
// claim leaves the queue. Each recipient gets one digest email per run.
//
// Safe to run concurrently (e.g. two instances firing the same cron): a claim
// is claimed for a run with a conditional update on its reminder state before
// any email is sent, so only one run can remind about it per window.
import { ClaimStatus, Role, type Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { env } from '../lib/env';
import { logger } from '../lib/logger';
import { recordAudit } from './auditLogService';
import { notifier as defaultNotifier, type EmailMessage, type Notifier } from './notifier';

const DAY_MS = 24 * 60 * 60 * 1000;
// The job fires at about the same time each day. Without some slack, a reminder
// sent a few seconds later yesterday would not be a full day old today and the
// claim would skip a day.
const MAX_REPEAT_GRACE_MS = 60 * 60 * 1000;

const REMINDABLE_STATUSES = [ClaimStatus.PENDING_APPROVAL, ClaimStatus.PENDING_FINANCE_APPROVAL];

/** Fields to set whenever a claim lands in a reviewer's queue — restarts the reminder clock. */
export function startReviewClock(now: Date = new Date()) {
  return { assignedAt: now, lastRemindedAt: null, reminderCount: 0 };
}

export interface ReminderConfig {
  firstAfterDays: number;
  repeatEveryDays: number;
}

export interface ReminderRunOptions {
  now?: Date;
  notifier?: Notifier;
  config?: ReminderConfig;
}

export interface ReminderRunSummary {
  claimsReminded: number;
  emailsSent: number;
  emailsFailed: number;
}

/** Claims overdue for a reminder at `now`. */
export function overdueClaimsWhere(now: Date, config: ReminderConfig): Prisma.ClaimWhereInput {
  const repeatMs = config.repeatEveryDays * DAY_MS;
  const grace = Math.min(MAX_REPEAT_GRACE_MS, repeatMs / 2);
  return {
    status: { in: REMINDABLE_STATUSES },
    assignedAt: { lte: new Date(now.getTime() - config.firstAfterDays * DAY_MS) },
    OR: [{ lastRemindedAt: null }, { lastRemindedAt: { lte: new Date(now.getTime() - repeatMs + grace) } }],
  };
}

const overdueClaimSelect = {
  id: true,
  title: true,
  total: true,
  status: true,
  assignedAt: true,
  lastRemindedAt: true,
  reminderCount: true,
  claimant: { select: { name: true } },
  assignedApprover: { select: { id: true, name: true, email: true, isActive: true } },
} satisfies Prisma.ClaimSelect;

type OverdueClaim = Prisma.ClaimGetPayload<{ select: typeof overdueClaimSelect }>;

interface Recipient {
  id: string;
  name: string;
  email: string;
  role: Role;
}

interface ReminderGroup {
  recipients: Recipient[];
  claims: OverdueClaim[];
}

function groupByRecipient(claims: OverdueClaim[], financeUsers: Recipient[]): ReminderGroup[] {
  const byApprover = new Map<string, ReminderGroup>();
  const financeClaims: OverdueClaim[] = [];

  for (const claim of claims) {
    const approver = claim.assignedApprover;
    if (claim.status === ClaimStatus.PENDING_APPROVAL && approver?.isActive) {
      const group = byApprover.get(approver.id) ?? {
        recipients: [{ id: approver.id, name: approver.name, email: approver.email, role: Role.APPROVER }],
        claims: [],
      };
      group.claims.push(claim);
      byApprover.set(approver.id, group);
    } else {
      // Finance stage, or an approver who can no longer act — Finance can decide either.
      financeClaims.push(claim);
    }
  }

  const groups = [...byApprover.values()];
  if (financeClaims.length > 0) {
    if (financeUsers.length > 0) groups.push({ recipients: financeUsers, claims: financeClaims });
    else logger.warn(`[reminders] ${financeClaims.length} overdue claim(s) need Finance, but there are no active Finance users`);
  }
  return groups;
}

function waitingDays(claim: OverdueClaim, now: Date): number {
  return Math.floor((now.getTime() - claim.assignedAt!.getTime()) / DAY_MS);
}

function formatInr(amount: Prisma.Decimal): string {
  return `INR ${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function buildReminderEmail(recipient: Recipient, claims: OverdueClaim[], now: Date): EmailMessage {
  const toName = `${recipient.name} (${recipient.role === Role.FINANCE ? 'Finance' : 'Approver'})`;
  const queueUrl = `${env.appUrl}${recipient.role === Role.FINANCE ? '/finance/claims' : '/approver/claims'}`;
  const count = claims.length;
  const title = `${count} expense claim${count === 1 ? '' : 's'} awaiting your approval`;
  const intro = `The following expense claim${count === 1 ? ' is' : 's are'} still waiting for your review:`;
  const outro = 'Please approve, reject or request more information.';

  const rows = claims.map((c) => {
    const days = waitingDays(c, now);
    return { claim: c, url: `${queueUrl}/${c.id}`, waiting: `Waiting ${days} day${days === 1 ? '' : 's'} for your decision` };
  });

  const text = [
    `Hi ${toName},`,
    '',
    intro,
    '',
    ...rows.map((r) => [`- ${r.claim.title} (${r.claim.claimant.name}) — ${formatInr(r.claim.total)}`, `  ${r.waiting}`, `  ${r.url}`].join('\n')),
    '',
    outro,
  ].join('\n');

  const html = [
    `<p>Hi ${escapeHtml(toName)},</p>`,
    `<p>${intro}</p>`,
    '<ul>',
    ...rows.map(
      (r) =>
        `<li style="margin-bottom:8px;"><a href="${r.url}" style="color:#2563eb;font-weight:600;text-decoration:none;">${escapeHtml(r.claim.title)}</a>` +
        ` (${escapeHtml(r.claim.claimant.name)}) — ${formatInr(r.claim.total)}<br/><span style="color:#64748b;">${r.waiting}</span></li>`,
    ),
    '</ul>',
    `<p>${outro}</p>`,
  ].join('');

  return { to: recipient.email, toName, subject: `Reminder: ${title}`, title, text, html, linkUrl: queueUrl };
}

/** Marks the claims as reminded at `now`, skipping any whose state changed since they were read. */
async function claimForRun(claims: OverdueClaim[], now: Date): Promise<OverdueClaim[]> {
  const claimed: OverdueClaim[] = [];
  for (const c of claims) {
    const { count } = await prisma.claim.updateMany({
      where: { id: c.id, status: c.status, assignedAt: c.assignedAt, lastRemindedAt: c.lastRemindedAt },
      data: { lastRemindedAt: now, reminderCount: { increment: 1 } },
    });
    if (count === 1) claimed.push(c);
  }
  return claimed;
}

/** Undoes `claimForRun` when no email for the group could be sent, so the next run retries. */
async function releaseClaims(claims: OverdueClaim[], now: Date): Promise<void> {
  for (const c of claims) {
    await prisma.claim.updateMany({
      where: { id: c.id, lastRemindedAt: now },
      data: { lastRemindedAt: c.lastRemindedAt, reminderCount: c.reminderCount },
    });
  }
}

export async function runApprovalReminders(options: ReminderRunOptions = {}): Promise<ReminderRunSummary> {
  const now = options.now ?? new Date();
  const notifier = options.notifier ?? defaultNotifier;
  const config = options.config ?? env.reminders;
  const summary: ReminderRunSummary = { claimsReminded: 0, emailsSent: 0, emailsFailed: 0 };

  const overdue = await prisma.claim.findMany({
    where: overdueClaimsWhere(now, config),
    select: overdueClaimSelect,
    orderBy: { assignedAt: 'asc' },
  });
  if (overdue.length === 0) return summary;

  const financeUsers = await prisma.user.findMany({
    where: { role: Role.FINANCE, isActive: true },
    select: { id: true, name: true, email: true, role: true },
  });

  for (const group of groupByRecipient(overdue, financeUsers)) {
    const claims = await claimForRun(group.claims, now);
    if (claims.length === 0) continue;

    const delivered: Recipient[] = [];
    for (const recipient of group.recipients) {
      try {
        await notifier.send(buildReminderEmail(recipient, claims, now));
        delivered.push(recipient);
        summary.emailsSent++;
      } catch (err) {
        summary.emailsFailed++;
        logger.error(`[reminders] failed to email ${recipient.email}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (delivered.length === 0) {
      await releaseClaims(claims, now);
      continue;
    }

    const recipientIds = delivered.map((r) => r.id);
    await prisma.$transaction(async (tx) => {
      for (const c of claims) {
        await recordAudit(tx, {
          claimId: c.id,
          actorId: null,
          action: 'APPROVAL_REMINDER_SENT',
          oldStatus: c.status,
          newStatus: c.status,
          metadata: { recipientIds, reminderCount: c.reminderCount + 1, waitingDays: waitingDays(c, now) },
        });
      }
    });
    summary.claimsReminded += claims.length;
  }

  return summary;
}
