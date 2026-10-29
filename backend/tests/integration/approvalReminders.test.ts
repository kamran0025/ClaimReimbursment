// Approval reminders — reviewers are emailed about claims that have waited in
// their queue too long: the assigned approver for PENDING_APPROVAL, every
// active Finance user for PENDING_FINANCE_APPROVAL.
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { migrateTestDb, resetTestDb, seedTestUsers, testPrisma, type SeededUsers } from '../helpers/testDb';
import { agentAs } from '../helpers/testApp';
import { runApprovalReminders } from '../../src/services/approvalReminderService';
import type { EmailMessage, Notifier } from '../../src/services/notifier';

const DAY_MS = 24 * 60 * 60 * 1000;
const config = { firstAfterDays: 2, repeatEveryDays: 1 };

let users: SeededUsers;

beforeAll(() => {
  migrateTestDb();
});

beforeEach(async () => {
  await resetTestDb();
  users = await seedTestUsers();
});

function fakeNotifier(failFor: string[] = []): Notifier & { sent: EmailMessage[] } {
  const sent: EmailMessage[] = [];
  return {
    sent,
    async send(message) {
      if (failFor.includes(message.to)) throw new Error('EmailJS down');
      sent.push(message);
    },
  };
}

async function submitClaim(claimantId: string, amount = 100, title = 'Reminder test') {
  const claimant = agentAs(claimantId);
  const created = await claimant.post('/claims').send({ title });
  const claimId = created.body.data.id as string;
  await claimant.post(`/claims/${claimId}/items`).send({
    expenseDate: new Date().toISOString().slice(0, 10),
    categoryId: users.categories.travel.id,
    description: 'Item',
    amount,
  });
  const res = await claimant.post(`/claims/${claimId}/submit`).send({});
  expect(res.status).toBe(200);
  return { claimId, approverId: res.body.data.assignedApproverId as string };
}

/** Pretends the claim landed in its reviewer's queue `days` ago. */
async function ageClaim(claimId: string, days: number) {
  await testPrisma.claim.update({ where: { id: claimId }, data: { assignedAt: new Date(Date.now() - days * DAY_MS) } });
}

async function emailOf(userId: string) {
  return (await testPrisma.user.findUniqueOrThrow({ where: { id: userId } })).email;
}

describe('approval reminders', () => {
  it('reminds the assigned approver once a claim has waited 2 days, in one digest per approver', async () => {
    const first = await submitClaim(users.claimantA.id, 100, 'Taxi');
    const second = await submitClaim(users.claimantB.id, 100, 'Hotel');
    // Both to the same approver, to check the digest.
    await testPrisma.claim.updateMany({ where: { id: { in: [first.claimId, second.claimId] } }, data: { assignedApproverId: users.approverA.id } });

    await ageClaim(first.claimId, 1.9);
    await ageClaim(second.claimId, 1.9);
    const early = fakeNotifier();
    expect(await runApprovalReminders({ notifier: early, config })).toEqual({ claimsReminded: 0, emailsSent: 0, emailsFailed: 0 });
    expect(early.sent).toHaveLength(0);

    await ageClaim(first.claimId, 2);
    await ageClaim(second.claimId, 3);
    const notifier = fakeNotifier();
    expect(await runApprovalReminders({ notifier, config })).toEqual({ claimsReminded: 2, emailsSent: 1, emailsFailed: 0 });
    expect(notifier.sent).toHaveLength(1);
    expect(notifier.sent[0].to).toBe(await emailOf(users.approverA.id));
    expect(notifier.sent[0].toName).toBe('Approver A (Approver)');
    expect(notifier.sent[0].html).toContain('Hi Approver A (Approver)');
    expect(notifier.sent[0].subject).toBe('Reminder: 2 expense claims awaiting your approval');
    expect(notifier.sent[0].text).toContain('Taxi');
    expect(notifier.sent[0].text).toContain('Hotel');
    expect(notifier.sent[0].text).toContain(`/approver/claims/${first.claimId}`);
    expect(notifier.sent[0].html).toContain(`/approver/claims/${first.claimId}`);
    expect(notifier.sent[0].linkUrl).toMatch(/\/approver\/claims$/);
  });

  it('escapes user-entered text in the HTML body', async () => {
    const { claimId } = await submitClaim(users.claimantA.id, 100, '<script>alert(1)</script>');
    await ageClaim(claimId, 2);
    const notifier = fakeNotifier();
    await runApprovalReminders({ notifier, config });
    expect(notifier.sent[0].html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(notifier.sent[0].html).not.toContain('<script>');
  });

  it('repeats every day, not more often', async () => {
    const { claimId } = await submitClaim(users.claimantA.id);
    await ageClaim(claimId, 2);
    const now = new Date();

    expect((await runApprovalReminders({ now, notifier: fakeNotifier(), config })).claimsReminded).toBe(1);
    // Same day again — nothing.
    expect((await runApprovalReminders({ now: new Date(now.getTime() + 6 * 60 * 60 * 1000), notifier: fakeNotifier(), config })).claimsReminded).toBe(0);
    // Next day's run, firing a few minutes earlier than yesterday's — still reminded.
    expect((await runApprovalReminders({ now: new Date(now.getTime() + DAY_MS - 5 * 60 * 1000), notifier: fakeNotifier(), config })).claimsReminded).toBe(1);

    const claim = await testPrisma.claim.findUniqueOrThrow({ where: { id: claimId } });
    expect(claim.reminderCount).toBe(2);
  });

  it('reminds every active Finance user about claims escalated to Finance, not the approver', async () => {
    const financeB = await testPrisma.user.create({
      data: { name: 'Finance B', email: 'test-financeB@example.com', role: 'FINANCE', passwordHash: 'x' },
    });
    const { claimId, approverId } = await submitClaim(users.claimantA.id, 30000);
    expect((await agentAs(approverId).post(`/claims/${claimId}/approve`).send({})).body.data.status).toBe('PENDING_FINANCE_APPROVAL');

    // Escalation restarts the clock.
    expect((await runApprovalReminders({ notifier: fakeNotifier(), config })).claimsReminded).toBe(0);

    await ageClaim(claimId, 2);
    const notifier = fakeNotifier();
    expect(await runApprovalReminders({ notifier, config })).toEqual({ claimsReminded: 1, emailsSent: 2, emailsFailed: 0 });
    expect(notifier.sent.map((m) => m.to).sort()).toEqual([await emailOf(users.finance.id), financeB.email].sort());
    expect(notifier.sent.map((m) => m.toName).sort()).toEqual(['Finance (Finance)', 'Finance B (Finance)']);
    expect(notifier.sent[0].text).toContain(`/finance/claims/${claimId}`);
  });

  it('sends an inactive approver’s overdue claims to Finance', async () => {
    const { claimId, approverId } = await submitClaim(users.claimantA.id);
    await testPrisma.user.update({ where: { id: approverId }, data: { isActive: false } });
    await ageClaim(claimId, 2);

    const notifier = fakeNotifier();
    await runApprovalReminders({ notifier, config });
    expect(notifier.sent.map((m) => m.to)).toEqual([await emailOf(users.finance.id)]);
  });

  it('skips claims waiting on the claimant or already decided, and restarts the clock when the claimant responds', async () => {
    const info = await submitClaim(users.claimantA.id);
    await agentAs(info.approverId).post(`/claims/${info.claimId}/request-info`).send({ message: 'Invoice?' });
    const approved = await submitClaim(users.claimantB.id);
    await agentAs(approved.approverId).post(`/claims/${approved.claimId}/approve`).send({});
    await ageClaim(info.claimId, 5);
    await ageClaim(approved.claimId, 5);

    expect((await runApprovalReminders({ notifier: fakeNotifier(), config })).claimsReminded).toBe(0);

    await agentAs(users.claimantA.id).post(`/claims/${info.claimId}/respond-info`).send({ message: 'Attached.' });
    expect((await runApprovalReminders({ notifier: fakeNotifier(), config })).claimsReminded).toBe(0);
  });

  it('restarts the clock when the claim is reassigned', async () => {
    const { claimId, approverId } = await submitClaim(users.claimantA.id);
    const otherApproverId = approverId === users.approverA.id ? users.approverB.id : users.approverA.id;
    await ageClaim(claimId, 3);
    await runApprovalReminders({ notifier: fakeNotifier(), config });

    await agentAs(approverId).post(`/claims/${claimId}/reassign`).send({ toApproverId: otherApproverId });
    const claim = await testPrisma.claim.findUniqueOrThrow({ where: { id: claimId } });
    expect(claim.lastRemindedAt).toBeNull();
    expect(claim.reminderCount).toBe(0);
    expect((await runApprovalReminders({ notifier: fakeNotifier(), config })).claimsReminded).toBe(0);

    await ageClaim(claimId, 2);
    const notifier = fakeNotifier();
    await runApprovalReminders({ notifier, config });
    expect(notifier.sent.map((m) => m.to)).toEqual([await emailOf(otherApproverId)]);
  });

  it('records a system audit row that the claimant cannot see', async () => {
    const { claimId, approverId } = await submitClaim(users.claimantA.id);
    await ageClaim(claimId, 2);
    await runApprovalReminders({ notifier: fakeNotifier(), config });

    const asApprover = await agentAs(approverId).get(`/audit/claims/${claimId}`);
    const row = asApprover.body.data.find((l: { action: string }) => l.action === 'APPROVAL_REMINDER_SENT');
    expect(row).toMatchObject({ actorId: null, metadata: { recipientIds: [approverId], reminderCount: 1, waitingDays: 2 } });

    const asClaimant = await agentAs(users.claimantA.id).get(`/audit/claims/${claimId}`);
    expect(asClaimant.body.data.some((l: { action: string }) => l.action === 'APPROVAL_REMINDER_SENT')).toBe(false);
  });

  it('retries on the next run when the email could not be sent', async () => {
    const { claimId, approverId } = await submitClaim(users.claimantA.id);
    await ageClaim(claimId, 2);

    const failing = fakeNotifier([await emailOf(approverId)]);
    expect(await runApprovalReminders({ notifier: failing, config })).toEqual({ claimsReminded: 0, emailsSent: 0, emailsFailed: 1 });
    const claim = await testPrisma.claim.findUniqueOrThrow({ where: { id: claimId } });
    expect(claim.lastRemindedAt).toBeNull();
    expect(claim.reminderCount).toBe(0);
    expect(await testPrisma.auditLog.count({ where: { claimId, action: 'APPROVAL_REMINDER_SENT' } })).toBe(0);

    expect((await runApprovalReminders({ notifier: fakeNotifier(), config })).claimsReminded).toBe(1);
  });

  it('only one of two concurrent runs sends the reminder', async () => {
    const { claimId } = await submitClaim(users.claimantA.id);
    await ageClaim(claimId, 2);
    const a = fakeNotifier();
    const b = fakeNotifier();
    await Promise.all([runApprovalReminders({ notifier: a, config }), runApprovalReminders({ notifier: b, config })]);
    expect(a.sent.length + b.sent.length).toBe(1);
  });
});

describe('POST /finance/reminders/run', () => {
  it('lets Finance trigger a run; other roles are forbidden', async () => {
    const res = await agentAs(users.finance.id).post('/finance/reminders/run').send({});
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ claimsReminded: 0, emailsSent: 0, emailsFailed: 0 });

    expect((await agentAs(users.approverA.id).post('/finance/reminders/run').send({})).status).toBe(403);
  });
});
