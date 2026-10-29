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

function itemBody(categoryId: string, description = 'Item') {
  return { expenseDate: new Date().toISOString().slice(0, 10), categoryId, description, amount: 500 };
}

async function draftWithItem(categoryId: string) {
  const claimant = agentAs(users.claimantA.id);
  const created = await claimant.post('/claims').send({ title: 'Category test' });
  const claimId = created.body.data.id as string;
  const withItem = await claimant.post(`/claims/${claimId}/items`).send(itemBody(categoryId));
  expect(withItem.status).toBe(201);
  return { claimant, claimId, itemId: withItem.body.data.items[0].id as string };
}

describe('expense categories — management', () => {
  it('Finance can create a category with an amount, then rename it and change the amount', async () => {
    const finance = agentAs(users.finance.id);

    const created = await finance.post('/categories').send({ name: '  Internet  ', maxAmount: 1500.5 });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ name: 'Internet', maxAmount: 1500.5 });
    const id = created.body.data.id;

    const renamed = await finance.patch(`/categories/${id}`).send({ name: 'Internet & Phone' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.data).toMatchObject({ name: 'Internet & Phone', maxAmount: 1500.5 });

    const repriced = await finance.patch(`/categories/${id}`).send({ maxAmount: 2000 });
    expect(repriced.status).toBe(200);
    expect(repriced.body.data.maxAmount).toBe(2000);
  });

  it('requires a positive amount when creating', async () => {
    const finance = agentAs(users.finance.id);
    expect((await finance.post('/categories').send({ name: 'No amount' })).status).toBe(400);
    expect((await finance.post('/categories').send({ name: 'Zero', maxAmount: 0 })).status).toBe(400);
    expect((await finance.post('/categories').send({ name: 'Negative', maxAmount: -5 })).status).toBe(400);
    expect(await testPrisma.expenseCategory.count({ where: { name: { in: ['No amount', 'Zero', 'Negative'] } } })).toBe(0);
  });

  it('rejects a duplicate name case-insensitively, on create and on rename', async () => {
    const finance = agentAs(users.finance.id);

    const dup = await finance.post('/categories').send({ name: 'travel', maxAmount: 100 });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('CATEGORY_NAME_TAKEN');

    const rename = await finance.patch(`/categories/${users.categories.meals.id}`).send({ name: 'TRAVEL' });
    expect(rename.status).toBe(409);
    expect(rename.body.error.code).toBe('CATEGORY_NAME_TAKEN');

    // Changing only the case of its own name is fine.
    const sameRow = await finance.patch(`/categories/${users.categories.meals.id}`).send({ name: 'MEALS' });
    expect(sameRow.status).toBe(200);
  });

  it('validates input and unknown ids', async () => {
    const finance = agentAs(users.finance.id);

    expect((await finance.post('/categories').send({ name: '   ', maxAmount: 100 })).status).toBe(400);
    expect((await finance.patch(`/categories/${users.categories.travel.id}`).send({})).status).toBe(400);

    const missing = await finance.patch('/categories/does-not-exist').send({ name: 'X' });
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('CATEGORY_NOT_FOUND');
    expect((await finance.delete('/categories/does-not-exist')).status).toBe(404);
  });

  it('only Finance can create, edit or delete categories; everyone can list them', async () => {
    for (const userId of [users.claimantA.id, users.approverA.id]) {
      const agent = agentAs(userId);
      expect((await agent.post('/categories').send({ name: 'Sneaky', maxAmount: 100 })).status).toBe(403);
      expect((await agent.patch(`/categories/${users.categories.travel.id}`).send({ maxAmount: 1 })).status).toBe(403);
      expect((await agent.delete(`/categories/${users.categories.lodging.id}`)).status).toBe(403);

      const list = await agent.get('/categories');
      expect(list.status).toBe(200);
      expect(list.body.data.map((c: { name: string }) => c.name)).toEqual(['Lodging', 'Meals', 'Travel']);
    }
    expect(await testPrisma.expenseCategory.count()).toBe(3);
  });
});

describe('expense categories — delete', () => {
  it('Finance can delete an unused category', async () => {
    const res = await agentAs(users.finance.id).delete(`/categories/${users.categories.lodging.id}`);
    expect(res.status).toBe(200);
    expect(await testPrisma.expenseCategory.findUnique({ where: { id: users.categories.lodging.id } })).toBeNull();
  });

  it('refuses to delete a category that line items use', async () => {
    await draftWithItem(users.categories.travel.id);

    const res = await agentAs(users.finance.id).delete(`/categories/${users.categories.travel.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CATEGORY_IN_USE');
    expect(res.body.error.details).toMatchObject({ itemCount: 1 });
    expect(await testPrisma.expenseCategory.findUnique({ where: { id: users.categories.travel.id } })).not.toBeNull();
  });
});

describe('expense categories — line items', () => {
  it('returns the category id and current name on items, so a rename shows on existing items', async () => {
    const { claimant, claimId } = await draftWithItem(users.categories.travel.id);

    await agentAs(users.finance.id).patch(`/categories/${users.categories.travel.id}`).send({ name: 'Business Travel' });

    const detail = await claimant.get(`/claims/${claimId}`);
    expect(detail.body.data.items[0]).toMatchObject({ categoryId: users.categories.travel.id, category: 'Business Travel' });
  });

  it('rejects an unknown category on new and edited items', async () => {
    const { claimant, claimId, itemId } = await draftWithItem(users.categories.travel.id);

    const add = await claimant.post(`/claims/${claimId}/items`).send(itemBody('nope'));
    expect(add.status).toBe(400);
    expect(add.body.error.details).toMatchObject({ field: 'categoryId' });

    const edit = await claimant.patch(`/claims/${claimId}/items/${itemId}`).send(itemBody('nope'));
    expect(edit.status).toBe(400);

    const switched = await claimant.patch(`/claims/${claimId}/items/${itemId}`).send(itemBody(users.categories.meals.id));
    expect(switched.status).toBe(200);
    expect(switched.body.data.items[0].category).toBe('Meals');
  });
});

describe('expense categories — over-limit flag', () => {
  // Seeded test categories all have a 5,000 limit.
  async function draftWithAmount(amount: number, categoryId = users.categories.travel.id) {
    const claimant = agentAs(users.claimantA.id);
    const claimId = (await claimant.post('/claims').send({ title: 'Limit test' })).body.data.id as string;
    const res = await claimant.post(`/claims/${claimId}/items`).send({ ...itemBody(categoryId), amount });
    return { claimant, claimId, res };
  }

  it('saves an over-limit item but flags it; items at or under the limit are not flagged', async () => {
    const over = await draftWithAmount(5000.01);
    expect(over.res.status).toBe(201);
    expect(over.res.body.data.items[0]).toMatchObject({ amount: 5000.01, categoryLimit: 5000, isOverLimit: true });

    const atLimit = await draftWithAmount(5000);
    expect(atLimit.res.body.data.items[0]).toMatchObject({ categoryLimit: 5000, isOverLimit: false });

    const audit = await testPrisma.auditLog.findFirst({ where: { claimId: over.claimId, action: 'ITEM_ADDED' } });
    expect(audit?.metadata).toMatchObject({ overLimit: true });
  });

  it('never flags items in a category without a limit', async () => {
    await testPrisma.expenseCategory.update({ where: { id: users.categories.meals.id }, data: { maxAmount: null } });
    const { res } = await draftWithAmount(999999, users.categories.meals.id);
    expect(res.body.data.items[0]).toMatchObject({ categoryLimit: null, isOverLimit: false });
  });

  it('editing the amount or category re-checks against the current limit', async () => {
    const { claimant, claimId, res } = await draftWithAmount(6000);
    const itemId = res.body.data.items[0].id;
    await testPrisma.expenseCategory.update({ where: { id: users.categories.meals.id }, data: { maxAmount: 10000 } });

    const lowered = await claimant.patch(`/claims/${claimId}/items/${itemId}`).send({ ...itemBody(users.categories.travel.id), amount: 4000 });
    expect(lowered.body.data.items[0].isOverLimit).toBe(false);

    const moved = await claimant.patch(`/claims/${claimId}/items/${itemId}`).send({ ...itemBody(users.categories.meals.id), amount: 6000 });
    expect(moved.body.data.items[0]).toMatchObject({ categoryLimit: 10000, isOverLimit: false });
  });

  it('a limit change applies to draft items but not to claims already in review', async () => {
    const draft = await draftWithAmount(6000);
    const submitted = await draftWithAmount(6000);
    expect((await submitted.claimant.post(`/claims/${submitted.claimId}/submit`).send({})).status).toBe(200);

    const finance = agentAs(users.finance.id);
    expect((await finance.patch(`/categories/${users.categories.travel.id}`).send({ maxAmount: 8000 })).status).toBe(200);

    const draftItem = (await draft.claimant.get(`/claims/${draft.claimId}`)).body.data.items[0];
    expect(draftItem).toMatchObject({ categoryLimit: 8000, isOverLimit: false });

    // The approver still sees the item as flagged against the limit it was submitted under.
    const reviewItem = (await finance.get(`/claims/${submitted.claimId}`)).body.data.items[0];
    expect(reviewItem).toMatchObject({ categoryLimit: 5000, isOverLimit: true });
  });
});
