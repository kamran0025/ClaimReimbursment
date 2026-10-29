import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { migrateTestDb, resetTestDb, seedTestUsers, testPrisma, type SeededUsers } from '../helpers/testDb';
import { agentAs } from '../helpers/testApp';

// Claims above FINANCE_APPROVAL_THRESHOLD (default 25,000) need two sign-offs:
// the assigned approver escalates, Finance makes the final decision.

let users: SeededUsers;

beforeAll(() => {
  migrateTestDb();
});

beforeEach(async () => {
  await resetTestDb();
  users = await seedTestUsers();
});

async function submitClaimFor(amount: number): Promise<{ claimId: string; approverId: string }> {
  const claimant = agentAs(users.claimantA.id);
  const created = await claimant.post('/claims').send({ title: 'Offsite' });
  const claimId = created.body.data.id;
  await claimant.post(`/claims/${claimId}/items`).send({
    expenseDate: new Date().toISOString().slice(0, 10),
    categoryId: users.categories.travel.id,
    description: 'Team travel',
    amount,
  });
  const submitted = await claimant.post(`/claims/${claimId}/submit`).send({});
  expect(submitted.status).toBe(200);
  return { claimId, approverId: submitted.body.data.assignedApproverId };
}

describe('approval hierarchy', () => {
  it('a claim at exactly the threshold is approved by the approver alone', async () => {
    const { claimId, approverId } = await submitClaimFor(25000);
    const res = await agentAs(approverId).post(`/claims/${claimId}/approve`).send({});
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('APPROVED');
    expect(res.body.data.requiresFinanceApproval).toBe(false);
  });

  it('above the threshold: approver approval escalates to Finance, Finance approves', async () => {
    const { claimId, approverId } = await submitClaimFor(30000);
    const approver = agentAs(approverId);

    const escalated = await approver.post(`/claims/${claimId}/approve`).send({});
    expect(escalated.status).toBe(200);
    expect(escalated.body.data.status).toBe('PENDING_FINANCE_APPROVAL');
    expect(escalated.body.data.requiresFinanceApproval).toBe(true);
    expect(escalated.body.data.approverApprovedById).toBe(approverId);
    expect(escalated.body.data.approverApprovedBy.id).toBe(approverId);
    expect(escalated.body.data.decidedById).toBeNull();

    // The approver can still see it, but can no longer decide it.
    expect((await approver.get(`/claims/${claimId}`)).status).toBe(200);
    for (const [path, body] of [
      ['approve', {}],
      ['reject', { reason: 'no' }],
      ['request-info', { message: 'more?' }],
    ] as const) {
      const blocked = await approver.post(`/claims/${claimId}/${path}`).send(body);
      expect(blocked.status).toBe(403);
      expect(blocked.body.error.code).toBe('FINANCE_APPROVAL_REQUIRED');
    }

    // Not cancellable once the approver has signed off.
    const cancel = await agentAs(users.claimantA.id).post(`/claims/${claimId}/cancel`);
    expect(cancel.status).toBe(409);

    const approved = await agentAs(users.finance.id).post(`/claims/${claimId}/approve`).send({});
    expect(approved.status).toBe(200);
    expect(approved.body.data.status).toBe('APPROVED');
    expect(approved.body.data.decidedById).toBe(users.finance.id);
    expect(approved.body.data.approverApprovedById).toBe(approverId);

    const auditActions = (await testPrisma.auditLog.findMany({ where: { claimId }, orderBy: { createdAt: 'asc' } })).map((a) => a.action);
    expect(auditActions.slice(-2)).toEqual(['CLAIM_ESCALATED', 'CLAIM_APPROVED']);
  });

  it('an info request at the Finance stage returns to Finance after the claimant responds', async () => {
    const { claimId, approverId } = await submitClaimFor(40000);
    await agentAs(approverId).post(`/claims/${claimId}/approve`).send({});

    const finance = agentAs(users.finance.id);
    const asked = await finance.post(`/claims/${claimId}/request-info`).send({ message: 'Attach the hotel invoice.' });
    expect(asked.body.data.status).toBe('INFO_REQUESTED');

    const approverTry = await agentAs(approverId).post(`/claims/${claimId}/approve`).send({});
    expect(approverTry.status).toBe(403);
    expect(approverTry.body.error.code).toBe('FINANCE_APPROVAL_REQUIRED');

    const responded = await agentAs(users.claimantA.id).post(`/claims/${claimId}/respond-info`).send({ message: 'Attached.' });
    expect(responded.status).toBe(200);
    expect(responded.body.data.status).toBe('PENDING_FINANCE_APPROVAL');
  });

  it('Finance rejection sends the claim back through both levels on resubmit', async () => {
    const { claimId, approverId } = await submitClaimFor(50000);
    await agentAs(approverId).post(`/claims/${claimId}/approve`).send({});
    const rejected = await agentAs(users.finance.id).post(`/claims/${claimId}/reject`).send({ reason: 'Over policy limit.' });
    expect(rejected.body.data.status).toBe('REJECTED');

    const resubmitted = await agentAs(users.claimantA.id).post(`/claims/${claimId}/resubmit`).send({});
    expect(resubmitted.status).toBe(200);
    expect(resubmitted.body.data.status).toBe('PENDING_APPROVAL');
    expect(resubmitted.body.data.assignedApproverId).toBe(approverId);
    expect(resubmitted.body.data.approverApprovedById).toBeNull();

    const again = await agentAs(approverId).post(`/claims/${claimId}/approve`).send({});
    expect(again.body.data.status).toBe('PENDING_FINANCE_APPROVAL');
  });

  it('Finance approving a high-value claim at the first level is final', async () => {
    const { claimId } = await submitClaimFor(30000);
    const res = await agentAs(users.finance.id).post(`/claims/${claimId}/approve`).send({});
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('APPROVED');
    expect(res.body.data.approverApprovedById).toBeNull();
  });

  it('approver dashboard drops escalated claims from the actionable queue', async () => {
    const { claimId, approverId } = await submitClaimFor(30000);
    await agentAs(approverId).post(`/claims/${claimId}/approve`).send({});

    const dash = await agentAs(approverId).get('/dashboards/approver');
    expect(dash.status).toBe(200);
    expect(dash.body.data.pendingCount).toBe(0);
    expect(dash.body.data.awaitingFinanceCount).toBe(1);
    expect(dash.body.data.approvedToday).toBe(1);
  });
});
