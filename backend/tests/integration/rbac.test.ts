// RBAC matrix smoke tests — plan-backend.md §6, task-backend.md §14.
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { migrateTestDb, resetTestDb, seedTestUsers, type SeededUsers } from '../helpers/testDb';
import { agentAs, anonAgent } from '../helpers/testApp';

let users: SeededUsers;

beforeAll(() => {
  migrateTestDb();
});

beforeEach(async () => {
  await resetTestDb();
  users = await seedTestUsers();
});

describe('RBAC matrix', () => {
  it('an unauthenticated request is rejected everywhere', async () => {
    const res = await anonAgent().get('/claims');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('a claimant sees only their own claims via GET /claims', async () => {
    const claimantA = agentAs(users.claimantA.id);
    const claimantB = agentAs(users.claimantB.id);
    await claimantA.post('/claims').send({ title: 'A1' });
    await claimantB.post('/claims').send({ title: 'B1' });

    const listA = await claimantA.get('/claims');
    expect(listA.body.data.items).toHaveLength(1);
    expect(listA.body.data.items[0].title).toBe('A1');
  });

  it('Finance never sees DRAFT claims (only the owning claimant may)', async () => {
    const claimant = agentAs(users.claimantA.id);
    await claimant.post('/claims').send({ title: 'Still drafting' });

    const finance = agentAs(users.finance.id);
    const list = await finance.get('/claims');
    expect(list.body.data.items).toHaveLength(0);
  });

  it('an approver only sees claims assigned to them', async () => {
    const claimant = agentAs(users.claimantA.id);
    const created = await claimant.post('/claims').send({ title: 'Assigned to A' });
    const claimId = created.body.data.id;
    await claimant.post(`/claims/${claimId}/items`).send({
      expenseDate: new Date().toISOString().slice(0, 10),
      category: 'Travel',
      description: 'Item',
      amount: 100,
    });
    await claimant.post(`/claims/${claimId}/submit`).send({ assignedApproverId: users.approverA.id });

    const approverA = agentAs(users.approverA.id);
    const approverB = agentAs(users.approverB.id);
    expect((await approverA.get('/claims')).body.data.items).toHaveLength(1);
    expect((await approverB.get('/claims')).body.data.items).toHaveLength(0);
  });

  it('only Finance can access the global audit log and CSV export', async () => {
    const claimant = agentAs(users.claimantA.id);
    const approver = agentAs(users.approverA.id);
    const finance = agentAs(users.finance.id);

    expect((await claimant.get('/audit')).status).toBe(403);
    expect((await approver.get('/audit')).status).toBe(403);
    expect((await finance.get('/audit')).status).toBe(200);

    expect((await claimant.get('/finance/export')).status).toBe(403);
    expect((await finance.get('/finance/export')).status).toBe(200);
  });

  it('each role can only reach its own dashboard endpoint', async () => {
    const claimant = agentAs(users.claimantA.id);
    const approver = agentAs(users.approverA.id);
    const finance = agentAs(users.finance.id);

    expect((await claimant.get('/dashboards/claimant')).status).toBe(200);
    expect((await claimant.get('/dashboards/approver')).status).toBe(403);
    expect((await claimant.get('/dashboards/finance')).status).toBe(403);

    expect((await approver.get('/dashboards/approver')).status).toBe(200);
    expect((await approver.get('/dashboards/claimant')).status).toBe(403);

    expect((await finance.get('/dashboards/finance')).status).toBe(200);
    expect((await finance.get('/dashboards/approver')).status).toBe(403);
  });

  it('any authenticated user can list active approvers, but only Finance sees the employee directory', async () => {
    const claimant = agentAs(users.claimantA.id);
    const approver = agentAs(users.approverA.id);
    const finance = agentAs(users.finance.id);

    expect((await claimant.get('/users/approvers')).status).toBe(200);
    expect((await approver.get('/users/approvers')).status).toBe(200);

    expect((await claimant.get('/users/employees')).status).toBe(403);
    expect((await finance.get('/users/employees')).status).toBe(200);
  });
});
