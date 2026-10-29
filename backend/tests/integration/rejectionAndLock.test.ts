// Requirements 3.3 (rejection & resubmission keeps reason + history) and
// 3.4 (a fully approved claim is read-only through every API path).
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

/** A submitted one-item claim with a receipt on that item. */
async function createSubmittedClaim(amount = 1000) {
  const claimant = agentAs(users.claimantA.id);
  const claimId = (await claimant.post('/claims').send({ title: 'Original title' })).body.data.id as string;
  const withItem = await claimant.post(`/claims/${claimId}/items`).send(itemBody(amount));
  const itemId = withItem.body.data.items[0].id as string;
  const withReceipt = await claimant
    .post(`/claims/${claimId}/receipts`)
    .field('claimItemId', itemId)
    .attach('file', Buffer.from('%PDF-1.4 test'), { filename: 'receipt.pdf', contentType: 'application/pdf' });
  expect(withReceipt.status).toBe(201);
  const receiptId = withReceipt.body.data.receipts[0].id as string;
  const submitted = await claimant.post(`/claims/${claimId}/submit`).send({});
  expect(submitted.status).toBe(200);
  return { claimant, claimId, itemId, receiptId, approverId: submitted.body.data.assignedApproverId as string };
}

describe('3.3 rejection and resubmission', () => {
  it('a rejected claim comes back to the claimant with its reason, and is editable', async () => {
    const { claimant, claimId, itemId, receiptId, approverId } = await createSubmittedClaim();
    await agentAs(approverId).post(`/claims/${claimId}/reject`).send({ reason: 'Missing itemized bill.' });

    const detail = await claimant.get(`/claims/${claimId}`);
    expect(detail.body.data).toMatchObject({ status: 'REJECTED', rejectionReason: 'Missing itemized bill.' });

    // Title, items and receipts are all editable again.
    expect((await claimant.patch(`/claims/${claimId}`).send({ title: 'Revised title' })).status).toBe(200);
    expect((await claimant.patch(`/claims/${claimId}/items/${itemId}`).send(itemBody(900, 'Edited'))).status).toBe(200);
    expect((await claimant.post(`/claims/${claimId}/items`).send(itemBody(300, 'Added'))).status).toBe(201);
    expect((await claimant.delete(`/claims/${claimId}/receipts/${receiptId}`)).status).toBe(200);
  });

  it('the reason and history survive edits and repeated resubmission', async () => {
    const { claimant, claimId, itemId, approverId } = await createSubmittedClaim();
    const approver = agentAs(approverId);

    await approver.post(`/claims/${claimId}/reject`).send({ reason: 'First reason.' });
    await claimant.patch(`/claims/${claimId}/items/${itemId}`).send(itemBody(800, 'Fixed once'));
    expect((await claimant.post(`/claims/${claimId}/resubmit`).send({})).status).toBe(200);

    await approver.post(`/claims/${claimId}/reject`).send({ reason: 'Second reason.' });
    await claimant.patch(`/claims/${claimId}/items/${itemId}`).send(itemBody(700, 'Fixed twice'));
    const resubmitted = await claimant.post(`/claims/${claimId}/resubmit`).send({});
    expect(resubmitted.body.data).toMatchObject({ status: 'PENDING_APPROVAL', submissionCycle: 3, rejectionReason: null });

    // The claimant can read the full history, with both reasons in order.
    const audit = await claimant.get(`/audit/claims/${claimId}`);
    expect(audit.status).toBe(200);
    const logs = audit.body.data as { action: string; metadata?: { reason?: string } }[];
    expect(logs.filter((l) => l.action === 'CLAIM_REJECTED').map((l) => l.metadata?.reason)).toEqual(['First reason.', 'Second reason.']);
    expect(logs.filter((l) => l.action === 'CLAIM_RESUBMITTED')).toHaveLength(2);
    expect(logs.filter((l) => l.action === 'ITEM_UPDATED')).toHaveLength(2);
  });
});

describe('3.4 approved claims are locked', () => {
  async function snapshot(claimId: string) {
    const claim = await testPrisma.claim.findUniqueOrThrow({
      where: { id: claimId },
      include: { items: { orderBy: { id: 'asc' } }, receipts: { orderBy: { id: 'asc' } }, messages: true },
    });
    return JSON.parse(JSON.stringify(claim));
  }

  async function expectEveryMutationRefused(claimId: string, itemId: string, receiptId: string, approverId: string) {
    const before = await snapshot(claimId);
    const claimant = agentAs(users.claimantA.id);

    const attempts = {
      'PATCH claim': await claimant.patch(`/claims/${claimId}`).send({ title: 'Sneaky' }),
      'POST item': await claimant.post(`/claims/${claimId}/items`).send(itemBody(50)),
      'PATCH item': await claimant.patch(`/claims/${claimId}/items/${itemId}`).send(itemBody(99999)),
      'DELETE item': await claimant.delete(`/claims/${claimId}/items/${itemId}`),
      'POST receipt': await claimant
        .post(`/claims/${claimId}/receipts`)
        .attach('file', Buffer.from('%PDF-1.4 x'), { filename: 'x.pdf', contentType: 'application/pdf' }),
      'POST item receipt': await claimant
        .post(`/claims/${claimId}/receipts`)
        .field('claimItemId', itemId)
        .attach('file', Buffer.from('%PDF-1.4 x'), { filename: 'x.pdf', contentType: 'application/pdf' }),
      'DELETE receipt': await claimant.delete(`/claims/${claimId}/receipts/${receiptId}`),
      submit: await claimant.post(`/claims/${claimId}/submit`).send({}),
      resubmit: await claimant.post(`/claims/${claimId}/resubmit`).send({}),
      cancel: await claimant.post(`/claims/${claimId}/cancel`).send({}),
      'respond-info': await claimant.post(`/claims/${claimId}/respond-info`).send({ message: 'More info' }),
      'approver reject': await agentAs(approverId).post(`/claims/${claimId}/reject`).send({ reason: 'Changed my mind' }),
      'finance reject': await agentAs(users.finance.id).post(`/claims/${claimId}/reject`).send({ reason: 'Changed my mind' }),
      'finance request-info': await agentAs(users.finance.id).post(`/claims/${claimId}/request-info`).send({ message: 'Why?' }),
      'finance approve again': await agentAs(users.finance.id).post(`/claims/${claimId}/approve`).send({}),
      reassign: await agentAs(users.finance.id).post(`/claims/${claimId}/reassign`).send({ toApproverId: users.approverB.id }),
    };

    const unexpected = Object.entries(attempts)
      .filter(([, res]) => res.status < 400)
      .map(([name, res]) => `${name} -> ${res.status}`);
    expect(unexpected).toEqual([]);

    // Nothing about the claim, its items, receipts or messages changed.
    expect(await snapshot(claimId)).toEqual(before);
  }

  it('a claim approved by its approver is read-only through every API path', async () => {
    const { claimId, itemId, receiptId, approverId } = await createSubmittedClaim();
    const approved = await agentAs(approverId).post(`/claims/${claimId}/approve`).send({});
    expect(approved.body.data.status).toBe('APPROVED');

    await expectEveryMutationRefused(claimId, itemId, receiptId, approverId);
  });

  it('a claim above the Finance threshold is locked only once Finance gives final approval', async () => {
    const { claimant, claimId, itemId, receiptId, approverId } = await createSubmittedClaim(30000);

    const escalated = await agentAs(approverId).post(`/claims/${claimId}/approve`).send({});
    expect(escalated.body.data.status).toBe('PENDING_FINANCE_APPROVAL');
    // Still not editable by the claimant while waiting on Finance.
    expect((await claimant.patch(`/claims/${claimId}/items/${itemId}`).send(itemBody(1))).status).toBe(409);

    const approved = await agentAs(users.finance.id).post(`/claims/${claimId}/approve`).send({});
    expect(approved.body.data.status).toBe('APPROVED');

    await expectEveryMutationRefused(claimId, itemId, receiptId, approverId);
  });
});
