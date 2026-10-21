// Automatic approver assignment — least open workload first, round-robin on
// ties, and resubmissions stay with the previous approver while active.
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { migrateTestDb, resetTestDb, seedTestUsers, testPrisma, type SeededUsers } from '../helpers/testDb';
import { agentAs } from '../helpers/testApp';

let users: SeededUsers;

beforeAll(() => {
  migrateTestDb();
});

beforeEach(async () => {
  await resetTestDb();
  users = await seedTestUsers();
});

async function createDraftWithItem(claimantId: string) {
  const claimant = agentAs(claimantId);
  const created = await claimant.post('/claims').send({ title: 'Assignment test' });
  const claimId = created.body.data.id as string;
  await claimant.post(`/claims/${claimId}/items`).send({
    expenseDate: new Date().toISOString().slice(0, 10),
    category: 'Travel',
    description: 'Item',
    amount: 100,
  });
  return claimId;
}

async function submit(claimantId: string) {
  const claimId = await createDraftWithItem(claimantId);
  const res = await agentAs(claimantId).post(`/claims/${claimId}/submit`).send({});
  expect(res.status).toBe(200);
  return { claimId, approverId: res.body.data.assignedApproverId as string };
}

describe('automatic approver assignment', () => {
  it('rotates between approvers when their open workload is equal', async () => {
    const assigned = [];
    for (let i = 0; i < 4; i++) assigned.push((await submit(users.claimantA.id)).approverId);

    expect(assigned[0]).not.toBe(assigned[1]);
    expect(assigned[2]).toBe(assigned[0]);
    expect(assigned[3]).toBe(assigned[1]);
  });

  it('prefers the approver with fewer open claims over plain rotation', async () => {
    const first = await submit(users.claimantA.id);
    await submit(users.claimantA.id);
    const third = await submit(users.claimantA.id);
    expect(third.approverId).toBe(first.approverId);

    // `first.approverId` was assigned most recently, but clears their queue — they now carry 0 open claims vs 1.
    await agentAs(first.approverId).post(`/claims/${first.claimId}/approve`).send({});
    await agentAs(first.approverId).post(`/claims/${third.claimId}/approve`).send({});

    const next = await submit(users.claimantB.id);
    expect(next.approverId).toBe(first.approverId);
  });

  it('a resubmitted claim stays with the approver who rejected it', async () => {
    const { claimId, approverId } = await submit(users.claimantA.id);
    await submit(users.claimantB.id);
    const third = await submit(users.claimantB.id);
    expect(third.approverId).toBe(approverId);
    await agentAs(approverId).post(`/claims/${claimId}/reject`).send({ reason: 'Fix the bill.' });
    // Loads are now 1/1 and `approverId` was assigned most recently, so a fresh pick would go to the other approver.

    const res = await agentAs(users.claimantA.id).post(`/claims/${claimId}/resubmit`).send({});
    expect(res.status).toBe(200);
    expect(res.body.data.assignedApproverId).toBe(approverId);
  });

  it('a resubmitted claim is reassigned when its previous approver has been deactivated', async () => {
    const { claimId, approverId } = await submit(users.claimantA.id);
    await agentAs(approverId).post(`/claims/${claimId}/reject`).send({ reason: 'Fix the bill.' });
    await testPrisma.user.update({ where: { id: approverId }, data: { isActive: false } });

    const res = await agentAs(users.claimantA.id).post(`/claims/${claimId}/resubmit`).send({});
    expect(res.status).toBe(200);
    expect(res.body.data.assignedApproverId).not.toBe(approverId);
  });

  it('submission fails with NO_APPROVER_AVAILABLE when there is no active approver', async () => {
    await testPrisma.user.updateMany({ where: { role: 'APPROVER' }, data: { isActive: false } });
    const claimId = await createDraftWithItem(users.claimantA.id);

    const res = await agentAs(users.claimantA.id).post(`/claims/${claimId}/submit`).send({});
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NO_APPROVER_AVAILABLE');

    const claim = await testPrisma.claim.findUniqueOrThrow({ where: { id: claimId } });
    expect(claim.status).toBe('DRAFT');
  });
});
