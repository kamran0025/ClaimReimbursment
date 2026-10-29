// Approver delegation — the assigned approver or Finance hands a claim (or a
// whole queue) to another approver; the claimant only sees a neutral notice.
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { migrateTestDb, resetTestDb, seedTestUsers, testPrisma, type SeededUsers } from '../helpers/testDb';
import { agentAs, anonAgent } from '../helpers/testApp';

let users: SeededUsers;

beforeAll(() => {
  migrateTestDb();
});

beforeEach(async () => {
  await resetTestDb();
  users = await seedTestUsers();
});

async function submitClaim(claimantId: string, amount = 100) {
  const claimant = agentAs(claimantId);
  const created = await claimant.post('/claims').send({ title: 'Delegation test' });
  const claimId = created.body.data.id as string;
  await claimant.post(`/claims/${claimId}/items`).send({
    expenseDate: new Date().toISOString().slice(0, 10),
    categoryId: users.categories.travel.id,
    description: 'Item',
    amount,
  });
  const res = await claimant.post(`/claims/${claimId}/submit`).send({});
  expect(res.status).toBe(200);
  const approverId = res.body.data.assignedApproverId as string;
  const otherApproverId = approverId === users.approverA.id ? users.approverB.id : users.approverA.id;
  return { claimId, approverId, otherApproverId };
}

describe('POST /claims/:id/reassign', () => {
  it('the assigned approver hands the claim over; the new approver sees its full history and the old one loses access', async () => {
    const { claimId, approverId, otherApproverId } = await submitClaim(users.claimantA.id);
    await agentAs(approverId).post(`/claims/${claimId}/request-info`).send({ message: 'Please attach the invoice.' });

    const res = await agentAs(approverId).post(`/claims/${claimId}/reassign`).send({ toApproverId: otherApproverId, reason: 'On leave' });
    expect(res.status).toBe(200);
    expect(res.body.data.assignedApproverId).toBe(otherApproverId);
    expect(res.body.data.status).toBe('INFO_REQUESTED');

    const asNew = await agentAs(otherApproverId).get(`/claims/${claimId}`);
    expect(asNew.status).toBe(200);
    expect(asNew.body.data.messages.map((m: { type: string }) => m.type)).toEqual(['INFO_REQUEST', 'APPROVER_CHANGED']);
    const newAudit = await agentAs(otherApproverId).get(`/audit/claims/${claimId}`);
    expect(newAudit.status).toBe(200);
    const reassigned = newAudit.body.data.find((l: { action: string }) => l.action === 'CLAIM_REASSIGNED');
    expect(reassigned.actorId).toBe(approverId);
    expect(reassigned.metadata).toEqual({ fromApproverId: approverId, toApproverId: otherApproverId, reason: 'On leave' });

    expect((await agentAs(approverId).get(`/claims/${claimId}`)).status).toBe(403);
    // The new approver can decide it.
    expect((await agentAs(otherApproverId).post(`/claims/${claimId}/approve`).send({})).status).toBe(200);
  });

  it('Finance can change the approver of any claim still with its approver', async () => {
    const { claimId, otherApproverId } = await submitClaim(users.claimantA.id);
    const res = await agentAs(users.finance.id).post(`/claims/${claimId}/reassign`).send({ toApproverId: otherApproverId });
    expect(res.status).toBe(200);
    expect(res.body.data.assignedApproverId).toBe(otherApproverId);
  });

  it('the claimant only sees a sender-less notice — no audit row, reason or actor', async () => {
    const { claimId, approverId, otherApproverId } = await submitClaim(users.claimantA.id);
    await agentAs(approverId).post(`/claims/${claimId}/reassign`).send({ toApproverId: otherApproverId, reason: 'Secret reason' });

    const detail = await agentAs(users.claimantA.id).get(`/claims/${claimId}`);
    const notice = detail.body.data.messages.find((m: { type: string }) => m.type === 'APPROVER_CHANGED');
    expect(notice).toMatchObject({ senderId: null, message: 'The approver for this claim has been changed.' });
    expect(notice.sender).toBeUndefined();

    const audit = await agentAs(users.claimantA.id).get(`/audit/claims/${claimId}`);
    expect(audit.status).toBe(200);
    expect(audit.body.data.some((l: { action: string }) => l.action === 'CLAIM_REASSIGNED')).toBe(false);
    expect(JSON.stringify(audit.body.data)).not.toContain('Secret reason');
  });

  it('a resubmission after rejection stays with the new approver', async () => {
    const { claimId, approverId, otherApproverId } = await submitClaim(users.claimantA.id);
    await agentAs(approverId).post(`/claims/${claimId}/reassign`).send({ toApproverId: otherApproverId });
    await agentAs(otherApproverId).post(`/claims/${claimId}/reject`).send({ reason: 'Fix it.' });

    const res = await agentAs(users.claimantA.id).post(`/claims/${claimId}/resubmit`).send({});
    expect(res.body.data.assignedApproverId).toBe(otherApproverId);
  });

  it('rejects callers who are not the current approver or Finance', async () => {
    const { claimId, otherApproverId } = await submitClaim(users.claimantA.id);
    expect((await anonAgent().post(`/claims/${claimId}/reassign`).send({ toApproverId: otherApproverId })).status).toBe(401);

    const asClaimant = await agentAs(users.claimantA.id).post(`/claims/${claimId}/reassign`).send({ toApproverId: otherApproverId });
    expect(asClaimant.status).toBe(403);
    expect(asClaimant.body.error.code).toBe('FORBIDDEN_ROLE');

    const asOther = await agentAs(otherApproverId).post(`/claims/${claimId}/reassign`).send({ toApproverId: otherApproverId });
    expect(asOther.status).toBe(403);
    expect(asOther.body.error.code).toBe('CLAIM_NOT_ASSIGNED');
  });

  it('validates the target approver', async () => {
    const { claimId, approverId, otherApproverId } = await submitClaim(users.claimantA.id);
    const asApprover = agentAs(approverId);

    expect((await asApprover.post(`/claims/${claimId}/reassign`).send({})).status).toBe(400);
    for (const toApproverId of [approverId, users.finance.id, users.claimantB.id, 'nope']) {
      const res = await asApprover.post(`/claims/${claimId}/reassign`).send({ toApproverId });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }

    await testPrisma.user.update({ where: { id: otherApproverId }, data: { isActive: false } });
    expect((await asApprover.post(`/claims/${claimId}/reassign`).send({ toApproverId: otherApproverId })).status).toBe(400);
    expect((await testPrisma.claim.findUniqueOrThrow({ where: { id: claimId } })).assignedApproverId).toBe(approverId);
  });

  it('refuses claims that are decided or already escalated to Finance', async () => {
    const decided = await submitClaim(users.claimantA.id);
    await agentAs(decided.approverId).post(`/claims/${decided.claimId}/approve`).send({});
    const res = await agentAs(users.finance.id).post(`/claims/${decided.claimId}/reassign`).send({ toApproverId: decided.otherApproverId });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CLAIM_NOT_REASSIGNABLE');

    const big = await submitClaim(users.claimantA.id, 10_000_000);
    await agentAs(big.approverId).post(`/claims/${big.claimId}/approve`).send({});
    const escalated = await agentAs(big.approverId).post(`/claims/${big.claimId}/reassign`).send({ toApproverId: big.otherApproverId });
    expect(escalated.status).toBe(409);
    expect(escalated.body.error.code).toBe('CLAIM_NOT_REASSIGNABLE');
  });
});

describe('POST /claims/reassign (bulk)', () => {
  it('an approver hands over their whole open queue, leaving decided and escalated claims alone', async () => {
    const first = await submitClaim(users.claimantA.id);
    const from = first.approverId;
    const to = first.otherApproverId;
    await submitClaim(users.claimantB.id); // goes to `to`
    const second = await submitClaim(users.claimantB.id); // back to `from`
    expect(second.approverId).toBe(from);
    await submitClaim(users.claimantA.id); // `to`
    const decided = await submitClaim(users.claimantA.id); // `from`
    expect(decided.approverId).toBe(from);
    await agentAs(from).post(`/claims/${decided.claimId}/approve`).send({});

    const res = await agentAs(from).post('/claims/reassign').send({ toApproverId: to, reason: 'Away next week' });
    expect(res.status).toBe(200);
    expect(res.body.data.reassignedCount).toBe(2);
    expect(res.body.data.claimIds.sort()).toEqual([first.claimId, second.claimId].sort());

    const remaining = await testPrisma.claim.findMany({ where: { assignedApproverId: from } });
    expect(remaining.map((c) => c.id)).toEqual([decided.claimId]);
    const audits = await testPrisma.auditLog.findMany({ where: { action: 'CLAIM_REASSIGNED' } });
    expect(audits).toHaveLength(2);
    expect(audits.every((a) => (a.metadata as Record<string, unknown>).bulk === true)).toBe(true);
  });

  it('Finance must name the approver whose queue to move, and may move anyone\'s', async () => {
    const { approverId, otherApproverId } = await submitClaim(users.claimantA.id);
    const finance = agentAs(users.finance.id);
    expect((await finance.post('/claims/reassign').send({ toApproverId: otherApproverId })).status).toBe(400);

    const res = await finance.post('/claims/reassign').send({ fromApproverId: approverId, toApproverId: otherApproverId });
    expect(res.status).toBe(200);
    expect(res.body.data.reassignedCount).toBe(1);
  });

  it('an approver cannot hand over another approver\'s queue', async () => {
    const { approverId, otherApproverId } = await submitClaim(users.claimantA.id);
    const res = await agentAs(otherApproverId).post('/claims/reassign').send({ fromApproverId: approverId, toApproverId: otherApproverId });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CLAIM_NOT_ASSIGNED');
  });

  it('with claimIds, is all-or-nothing', async () => {
    const mine = await submitClaim(users.claimantA.id);
    const theirs = await submitClaim(users.claimantA.id);
    expect(theirs.approverId).toBe(mine.otherApproverId);

    const res = await agentAs(mine.approverId)
      .post('/claims/reassign')
      .send({ claimIds: [mine.claimId, theirs.claimId], toApproverId: mine.otherApproverId });
    expect(res.status).toBe(403);
    expect((await testPrisma.claim.findUniqueOrThrow({ where: { id: mine.claimId } })).assignedApproverId).toBe(mine.approverId);
    expect(await testPrisma.claimMessage.count({ where: { type: 'APPROVER_CHANGED' } })).toBe(0);

    const ok = await agentAs(mine.approverId).post('/claims/reassign').send({ claimIds: [mine.claimId], toApproverId: mine.otherApproverId });
    expect(ok.status).toBe(200);
    expect(ok.body.data.reassignedCount).toBe(1);
  });

  it('rejects passing both claimIds and fromApproverId', async () => {
    const { claimId, approverId, otherApproverId } = await submitClaim(users.claimantA.id);
    const res = await agentAs(approverId).post('/claims/reassign').send({ claimIds: [claimId], fromApproverId: approverId, toApproverId: otherApproverId });
    expect(res.status).toBe(400);
  });
});
