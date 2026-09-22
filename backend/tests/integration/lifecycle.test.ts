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

describe('claim lifecycle — happy path', () => {
  it('draft -> submit -> approve', async () => {
    const claimant = agentAs(users.claimantA.id);

    const created = await claimant.post('/claims').send({ title: 'Client visit' });
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe('DRAFT');
    const claimId = created.body.data.id;

    const withItem = await claimant.post(`/claims/${claimId}/items`).send({
      expenseDate: new Date().toISOString().slice(0, 10),
      category: 'Travel',
      description: 'Cab fare',
      amount: 500,
    });
    expect(withItem.status).toBe(201);
    expect(withItem.body.data.total).toBe(500);

    const submitted = await claimant.post(`/claims/${claimId}/submit`).send({ assignedApproverId: users.approverA.id });
    expect(submitted.status).toBe(200);
    expect(submitted.body.data.status).toBe('PENDING_APPROVAL');
    expect(submitted.body.data.assignedApproverId).toBe(users.approverA.id);

    const approver = agentAs(users.approverA.id);
    const approved = await approver.post(`/claims/${claimId}/approve`).send({});
    expect(approved.status).toBe(200);
    expect(approved.body.data.status).toBe('APPROVED');
    expect(approved.body.data.decidedById).toBe(users.approverA.id);

    const auditActions = (await testPrisma.auditLog.findMany({ where: { claimId }, orderBy: { createdAt: 'asc' } })).map((a) => a.action);
    expect(auditActions).toEqual(['CLAIM_CREATED', 'ITEM_ADDED', 'CLAIM_SUBMITTED', 'CLAIM_APPROVED']);
  });

  it('info-request round trip: submit -> request-info -> respond-info -> approve', async () => {
    const claimant = agentAs(users.claimantA.id);
    const created = await claimant.post('/claims').send({ title: 'Conference trip' });
    const claimId = created.body.data.id;
    await claimant.post(`/claims/${claimId}/items`).send({
      expenseDate: new Date().toISOString().slice(0, 10),
      category: 'Travel',
      description: 'Flight',
      amount: 8000,
    });
    await claimant.post(`/claims/${claimId}/submit`).send({ assignedApproverId: users.approverA.id });

    const approver = agentAs(users.approverA.id);
    const infoRequested = await approver.post(`/claims/${claimId}/request-info`).send({ message: 'Attach the invoice please.' });
    expect(infoRequested.status).toBe(200);
    expect(infoRequested.body.data.status).toBe('INFO_REQUESTED');

    // Claimant cannot edit existing items while INFO_REQUESTED.
    const items = infoRequested.body.data.items;
    const blockedEdit = await claimant.patch(`/claims/${claimId}/items/${items[0].id}`).send({
      expenseDate: new Date().toISOString().slice(0, 10),
      category: 'Travel',
      description: 'Flight (edited)',
      amount: 9000,
    });
    expect(blockedEdit.status).toBe(409);
    expect(blockedEdit.body.error.code).toBe('CLAIM_NOT_EDITABLE');

    const responded = await claimant.post(`/claims/${claimId}/respond-info`).send({ message: 'Invoice is on file, please check attachments.' });
    expect(responded.status).toBe(200);
    expect(responded.body.data.status).toBe('PENDING_APPROVAL');

    const messages = await claimant.get(`/claims/${claimId}/messages`);
    expect(messages.body.data.map((m: { type: string }) => m.type)).toEqual(['INFO_REQUEST', 'RESPONSE']);

    const approved = await approver.post(`/claims/${claimId}/approve`).send({});
    expect(approved.status).toBe(200);
    expect(approved.body.data.status).toBe('APPROVED');
  });

  it('reject -> edit -> resubmit preserves rejection history and bumps submissionCycle', async () => {
    const claimant = agentAs(users.claimantA.id);
    const created = await claimant.post('/claims').send({ title: 'Team lunch' });
    const claimId = created.body.data.id;
    await claimant.post(`/claims/${claimId}/items`).send({
      expenseDate: new Date().toISOString().slice(0, 10),
      category: 'Meals',
      description: 'Lunch',
      amount: 1200,
    });
    await claimant.post(`/claims/${claimId}/submit`).send({ assignedApproverId: users.approverA.id });

    const approver = agentAs(users.approverA.id);
    const rejected = await approver.post(`/claims/${claimId}/reject`).send({ reason: 'Missing itemized bill.' });
    expect(rejected.status).toBe(200);
    expect(rejected.body.data.status).toBe('REJECTED');
    expect(rejected.body.data.rejectionReason).toBe('Missing itemized bill.');

    const edited = await claimant.patch(`/claims/${claimId}`).send({ title: 'Team lunch (revised)' });
    expect(edited.status).toBe(200);

    const resubmitted = await claimant.post(`/claims/${claimId}/resubmit`).send({ assignedApproverId: users.approverB.id });
    expect(resubmitted.status).toBe(200);
    expect(resubmitted.body.data.status).toBe('PENDING_APPROVAL');
    expect(resubmitted.body.data.submissionCycle).toBe(2);
    expect(resubmitted.body.data.assignedApproverId).toBe(users.approverB.id);
    // Rejection fields clear on the live claim, but the audit trail keeps the history.
    expect(resubmitted.body.data.rejectionReason).toBeNull();

    const auditActions = (await testPrisma.auditLog.findMany({ where: { claimId }, orderBy: { createdAt: 'asc' } })).map((a) => a.action);
    expect(auditActions).toContain('CLAIM_REJECTED');
    expect(auditActions).toContain('CLAIM_RESUBMITTED');
  });

  it('Finance can decide a claim assigned to an approver; the approver can no longer act on it afterward', async () => {
    const claimant = agentAs(users.claimantA.id);
    const created = await claimant.post('/claims').send({ title: 'Hotel stay' });
    const claimId = created.body.data.id;
    await claimant.post(`/claims/${claimId}/items`).send({
      expenseDate: new Date().toISOString().slice(0, 10),
      category: 'Accommodation',
      description: 'Hotel',
      amount: 3000,
    });
    await claimant.post(`/claims/${claimId}/submit`).send({ assignedApproverId: users.approverA.id });

    const finance = agentAs(users.finance.id);
    const approvedByFinance = await finance.post(`/claims/${claimId}/approve`).send({});
    expect(approvedByFinance.status).toBe(200);
    expect(approvedByFinance.body.data.decidedById).toBe(users.finance.id);

    const approver = agentAs(users.approverA.id);
    const tooLate = await approver.post(`/claims/${claimId}/approve`).send({});
    expect(tooLate.status).toBe(409);
    expect(tooLate.body.error.code).toBe('CLAIM_NOT_PENDING_APPROVAL');
  });
});
