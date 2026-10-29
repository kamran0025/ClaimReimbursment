// A claimant may edit their claim in place while it's PENDING_APPROVAL (until
// the approver acts). Edits and decisions are serialized by the claim row lock.
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

function itemBody(amount: number, description = 'Item') {
  return { expenseDate: new Date().toISOString().slice(0, 10), categoryId: users.categories.travel.id, description, amount };
}

async function createPendingClaim(amount = 1000) {
  const claimant = agentAs(users.claimantA.id);
  const claimId = (await claimant.post('/claims').send({ title: 'Pending claim' })).body.data.id as string;
  const withItem = await claimant.post(`/claims/${claimId}/items`).send(itemBody(amount));
  const submitted = await claimant.post(`/claims/${claimId}/submit`).send({});
  expect(submitted.body.data.status).toBe('PENDING_APPROVAL');
  return {
    claimant,
    claimId,
    itemId: withItem.body.data.items[0].id as string,
    approverId: submitted.body.data.assignedApproverId as string,
  };
}

describe('editing a PENDING_APPROVAL claim', () => {
  it('the claimant can edit title, items and receipts; the claim stays with its approver', async () => {
    const { claimant, claimId, itemId, approverId } = await createPendingClaim();

    expect((await claimant.patch(`/claims/${claimId}`).send({ title: 'Corrected title' })).status).toBe(200);
    expect((await claimant.patch(`/claims/${claimId}/items/${itemId}`).send(itemBody(1500, 'Corrected'))).status).toBe(200);
    expect((await claimant.post(`/claims/${claimId}/items`).send(itemBody(250, 'Forgot this'))).status).toBe(201);
    const withReceipt = await claimant
      .post(`/claims/${claimId}/receipts`)
      .field('claimItemId', itemId)
      .attach('file', Buffer.from('%PDF-1.4 test'), { filename: 'r.pdf', contentType: 'application/pdf' });
    expect(withReceipt.status).toBe(201);

    const detail = (await agentAs(approverId).get(`/claims/${claimId}`)).body.data;
    expect(detail).toMatchObject({ status: 'PENDING_APPROVAL', title: 'Corrected title', total: 1750, assignedApproverId: approverId });
    expect(detail.receipts).toHaveLength(1);

    const actions = (await testPrisma.auditLog.findMany({ where: { claimId }, orderBy: { createdAt: 'asc' } })).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(['CLAIM_UPDATED', 'ITEM_UPDATED', 'ITEM_ADDED', 'RECEIPT_UPLOADED']));
  });

  it('cannot delete the last line item of a submitted claim', async () => {
    const { claimant, claimId, itemId } = await createPendingClaim();
    const res = await claimant.delete(`/claims/${claimId}/items/${itemId}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CLAIM_EMPTY_ITEMS');

    // With a second item, deleting one is fine.
    await claimant.post(`/claims/${claimId}/items`).send(itemBody(200));
    expect((await claimant.delete(`/claims/${claimId}/items/${itemId}`)).status).toBe(200);
  });

  it('cannot be (re)submitted again while pending — edits apply in place', async () => {
    const { claimant, claimId } = await createPendingClaim();
    expect((await claimant.post(`/claims/${claimId}/submit`).send({})).status).toBe(409);
    expect((await claimant.post(`/claims/${claimId}/resubmit`).send({})).status).toBe(409);
  });

  it('other users still cannot edit it', async () => {
    const { claimId, itemId, approverId } = await createPendingClaim();
    for (const userId of [users.claimantB.id, approverId, users.finance.id]) {
      const res = await agentAs(userId).patch(`/claims/${claimId}/items/${itemId}`).send(itemBody(1));
      expect(res.status).toBe(403);
    }
  });

  it('locks again once the approver acts', async () => {
    const infoRequested = await createPendingClaim();
    await agentAs(infoRequested.approverId).post(`/claims/${infoRequested.claimId}/request-info`).send({ message: 'Why?' });
    expect((await infoRequested.claimant.patch(`/claims/${infoRequested.claimId}`).send({ title: 'x' })).status).toBe(409);

    const escalated = await createPendingClaim(30000);
    await agentAs(escalated.approverId).post(`/claims/${escalated.claimId}/approve`).send({});
    const atFinance = await escalated.claimant.patch(`/claims/${escalated.claimId}/items/${escalated.itemId}`).send(itemBody(1));
    expect(atFinance.status).toBe(409);
  });

  it('an edit racing the approver’s approval never lets a changed total skip the Finance check', async () => {
    for (let i = 0; i < 5; i++) {
      const { claimant, claimId, itemId, approverId } = await createPendingClaim(1000);

      // Raise the claim above the Finance threshold at the same moment the approver approves.
      const [edit, approve] = await Promise.all([
        claimant.patch(`/claims/${claimId}/items/${itemId}`).send(itemBody(30000)),
        agentAs(approverId).post(`/claims/${claimId}/approve`).send({}),
      ]);
      expect(approve.status).toBe(200);
      const final = await testPrisma.claim.findUniqueOrThrow({ where: { id: claimId } });

      if (edit.status === 200) {
        // Edit landed first: the approver approved the new total, which needs Finance.
        expect(Number(final.total)).toBe(30000);
        expect(final.status).toBe('PENDING_FINANCE_APPROVAL');
      } else {
        // Approval landed first: the edit was refused and the approved total is unchanged.
        expect(edit.status).toBe(409);
        expect(Number(final.total)).toBe(1000);
        expect(final.status).toBe('APPROVED');
      }
    }
  });
});
