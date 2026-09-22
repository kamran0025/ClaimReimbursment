// Mandatory security & data-integrity tests — plan-backend.md §9, task-backend.md §13.
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

async function createSubmittedClaim(claimantId: string, approverId: string, amount = 1000) {
  const claimant = agentAs(claimantId);
  const created = await claimant.post('/claims').send({ title: 'Test claim' });
  const claimId = created.body.data.id;
  await claimant.post(`/claims/${claimId}/items`).send({
    expenseDate: new Date().toISOString().slice(0, 10),
    category: 'Travel',
    description: 'Test item',
    amount,
  });
  await claimant.post(`/claims/${claimId}/submit`).send({ assignedApproverId: approverId });
  return claimId;
}

describe('security & data-integrity', () => {
  it('Claimant A cannot access Claimant B\'s claim', async () => {
    const claimant = agentAs(users.claimantA.id);
    const created = await claimant.post('/claims').send({ title: 'Private draft' });
    const claimId = created.body.data.id;

    const other = agentAs(users.claimantB.id);
    const res = await other.get(`/claims/${claimId}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CLAIM_NOT_OWNED');
  });

  it('Approver A cannot act on a claim assigned to Approver B', async () => {
    const claimId = await createSubmittedClaim(users.claimantA.id, users.approverB.id);
    const wrongApprover = agentAs(users.approverA.id);
    const res = await wrongApprover.post(`/claims/${claimId}/approve`).send({});
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CLAIM_NOT_ASSIGNED');
  });

  it('Claimant cannot call approve/reject/request-info', async () => {
    const claimId = await createSubmittedClaim(users.claimantA.id, users.approverA.id);
    const claimant = agentAs(users.claimantA.id);
    const approve = await claimant.post(`/claims/${claimId}/approve`).send({});
    expect(approve.status).toBe(403);
    expect(approve.body.error.code).toBe('FORBIDDEN_ROLE');

    const reject = await claimant.post(`/claims/${claimId}/reject`).send({ reason: 'nope' });
    expect(reject.status).toBe(403);

    const requestInfo = await claimant.post(`/claims/${claimId}/request-info`).send({ message: 'more info' });
    expect(requestInfo.status).toBe(403);
  });

  it('Finance CAN approve/reject/request-info on any PENDING_APPROVAL claim (v2 change)', async () => {
    const claimId = await createSubmittedClaim(users.claimantA.id, users.approverA.id);
    const finance = agentAs(users.finance.id);
    const res = await finance.post(`/claims/${claimId}/approve`).send({});
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('APPROVED');
  });

  it('a claim cannot be submitted without assignedApproverId', async () => {
    const claimant = agentAs(users.claimantA.id);
    const created = await claimant.post('/claims').send({ title: 'No approver' });
    const claimId = created.body.data.id;
    await claimant.post(`/claims/${claimId}/items`).send({
      expenseDate: new Date().toISOString().slice(0, 10),
      category: 'Travel',
      description: 'Item',
      amount: 100,
    });
    const res = await claimant.post(`/claims/${claimId}/submit`).send({});
    expect(res.status).toBe(400);
  });

  it('an approved claim rejects direct PATCH mutation', async () => {
    const claimId = await createSubmittedClaim(users.claimantA.id, users.approverA.id);
    await agentAs(users.approverA.id).post(`/claims/${claimId}/approve`).send({});
    const claimant = agentAs(users.claimantA.id);
    const res = await claimant.patch(`/claims/${claimId}`).send({ title: 'sneaky edit' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CLAIM_NOT_EDITABLE');
  });

  it('a client-supplied total is ignored; the server always recomputes it from line items', async () => {
    const claimant = agentAs(users.claimantA.id);
    const created = await claimant.post('/claims').send({ title: 'Total spoof attempt', total: 999999 });
    const claimId = created.body.data.id;
    expect(created.body.data.total).toBe(0);

    const withItem = await claimant.post(`/claims/${claimId}/items`).send({
      expenseDate: new Date().toISOString().slice(0, 10),
      category: 'Travel',
      description: 'Item',
      amount: 250,
    });
    expect(withItem.body.data.total).toBe(250);

    const patched = await claimant.patch(`/claims/${claimId}`).send({ title: 'still 250', total: 1 });
    expect(patched.body.data.total).toBe(250);

    const dbClaim = await testPrisma.claim.findUniqueOrThrow({ where: { id: claimId } });
    expect(Number(dbClaim.total)).toBe(250);
  });

  it('a zero line-item claim cannot be submitted', async () => {
    const claimant = agentAs(users.claimantA.id);
    const created = await claimant.post('/claims').send({ title: 'Empty claim' });
    const claimId = created.body.data.id;
    const res = await claimant.post(`/claims/${claimId}/submit`).send({ assignedApproverId: users.approverA.id });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CLAIM_EMPTY_ITEMS');
  });

  it('a negative or zero item amount is rejected', async () => {
    const claimant = agentAs(users.claimantA.id);
    const created = await claimant.post('/claims').send({ title: 'Bad amount' });
    const claimId = created.body.data.id;

    const zero = await claimant.post(`/claims/${claimId}/items`).send({
      expenseDate: new Date().toISOString().slice(0, 10),
      category: 'Travel',
      description: 'Item',
      amount: 0,
    });
    expect(zero.status).toBe(400);

    const negative = await claimant.post(`/claims/${claimId}/items`).send({
      expenseDate: new Date().toISOString().slice(0, 10),
      category: 'Travel',
      description: 'Item',
      amount: -50,
    });
    expect(negative.status).toBe(400);
  });

  it('User A cannot fetch User B\'s receipt', async () => {
    const claimant = agentAs(users.claimantA.id);
    const draft = await claimant.post('/claims').send({ title: 'Has a receipt' });
    const draftId = draft.body.data.id;
    const uploaded = await claimant
      .post(`/claims/${draftId}/receipts`)
      .attach('file', Buffer.from('%PDF-1.4 test'), { filename: 'receipt.pdf', contentType: 'application/pdf' });
    expect(uploaded.status).toBe(201);
    const receiptId = uploaded.body.data.receipts[0].id;

    const stranger = agentAs(users.claimantB.id);
    const res = await stranger.get(`/claims/${draftId}/receipts/${receiptId}`);
    expect(res.status).toBe(403);
  });

  it('the claimant cannot edit line items while INFO_REQUESTED, only respond + attach receipts', async () => {
    const claimId = await createSubmittedClaim(users.claimantA.id, users.approverA.id);
    const approver = agentAs(users.approverA.id);
    await approver.post(`/claims/${claimId}/request-info`).send({ message: 'need more detail' });

    const claimant = agentAs(users.claimantA.id);
    const addItemRes = await claimant.post(`/claims/${claimId}/items`).send({
      expenseDate: new Date().toISOString().slice(0, 10),
      category: 'Travel',
      description: 'New item',
      amount: 100,
    });
    expect(addItemRes.status).toBe(409);
    expect(addItemRes.body.error.code).toBe('CLAIM_NOT_EDITABLE');

    const respond = await claimant.post(`/claims/${claimId}/respond-info`).send({ message: 'Here is the detail.' });
    expect(respond.status).toBe(200);
    expect(respond.body.data.status).toBe('PENDING_APPROVAL');
  });

  it('only the claimant can call respond-info on their own claim', async () => {
    const claimId = await createSubmittedClaim(users.claimantA.id, users.approverA.id);
    await agentAs(users.approverA.id).post(`/claims/${claimId}/request-info`).send({ message: 'need more detail' });

    const stranger = agentAs(users.claimantB.id);
    const res = await stranger.post(`/claims/${claimId}/respond-info`).send({ message: 'not mine' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CLAIM_NOT_OWNED');
  });
});
