import { ClaimStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError, ErrorCode } from './errors';
import { serializeExpenseCategory } from './serializers';
import type { CreateCategoryInput, UpdateCategoryInput } from '../validation/categoryValidation';

/** GET /categories — every role needs the list (claimants pick from it for line items). */
export async function listCategories() {
  const categories = await prisma.expenseCategory.findMany({ orderBy: { name: 'asc' } });
  return categories.map(serializeExpenseCategory);
}

/** Names are unique case-insensitively ("travel" clashes with "Travel"); the DB index only catches exact duplicates. */
async function assertNameAvailable(name: string, exceptId?: string) {
  const clash = await prisma.expenseCategory.findFirst({
    where: { name: { equals: name, mode: 'insensitive' }, ...(exceptId ? { id: { not: exceptId } } : {}) },
  });
  if (clash) {
    throw new ApiError(ErrorCode.CATEGORY_NAME_TAKEN, `A category named "${clash.name}" already exists.`, { field: 'name' });
  }
}

function rethrowUniqueName(err: unknown): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    throw new ApiError(ErrorCode.CATEGORY_NAME_TAKEN, 'A category with this name already exists.', { field: 'name' });
  }
  throw err;
}

async function requireCategory(categoryId: string) {
  const category = await prisma.expenseCategory.findUnique({ where: { id: categoryId } });
  if (!category) throw new ApiError(ErrorCode.CATEGORY_NOT_FOUND, 'Category not found.');
  return category;
}

export async function createCategory(input: CreateCategoryInput) {
  await assertNameAvailable(input.name);
  const category = await prisma.expenseCategory
    .create({ data: { name: input.name, maxAmount: input.maxAmount } })
    .catch(rethrowUniqueName);
  return serializeExpenseCategory(category);
}

// Claims whose items still follow the category's current limit — the
// claimant can edit them (claimStateMachine.isEditableStatus). Items on claims
// in review keep the limit they were submitted under.
const LIVE_LIMIT_STATUSES = [ClaimStatus.DRAFT, ClaimStatus.REJECTED];

/** Renames apply to every existing line item (items reference the category by id). */
export async function updateCategory(categoryId: string, input: UpdateCategoryInput) {
  await requireCategory(categoryId);
  if (input.name !== undefined) await assertNameAvailable(input.name, categoryId);

  const category = await prisma
    .$transaction(async (tx) => {
      const updated = await tx.expenseCategory.update({
        where: { id: categoryId },
        data: { name: input.name, maxAmount: input.maxAmount },
      });
      if (input.maxAmount !== undefined) {
        await tx.claimItem.updateMany({
          where: { categoryId, claim: { status: { in: LIVE_LIMIT_STATUSES } } },
          data: { categoryLimit: updated.maxAmount },
        });
      }
      return updated;
    })
    .catch(rethrowUniqueName);
  return serializeExpenseCategory(category);
}

/**
 * Only unused categories can be deleted — removing one under existing line
 * items would rewrite claims' history. The FK (ON DELETE RESTRICT) backs this
 * up if an item is added between the count and the delete.
 */
export async function deleteCategory(categoryId: string) {
  await requireCategory(categoryId);
  const inUse = await prisma.claimItem.count({ where: { categoryId } });
  if (inUse > 0) {
    throw new ApiError(
      ErrorCode.CATEGORY_IN_USE,
      `This category is used by ${inUse} line item${inUse === 1 ? '' : 's'} and can't be deleted.`,
      { itemCount: inUse },
    );
  }
  await prisma.expenseCategory.delete({ where: { id: categoryId } }).catch((err: unknown) => {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
      throw new ApiError(ErrorCode.CATEGORY_IN_USE, "This category is used by line items and can't be deleted.");
    }
    throw err;
  });
}

/**
 * Loads the category a line item is being saved into (it must exist). Runs
 * inside the item mutation's transaction; the caller copies its `maxAmount`
 * onto the item as `categoryLimit`.
 */
export async function requireItemCategory(tx: Prisma.TransactionClient, categoryId: string) {
  const category = await tx.expenseCategory.findUnique({ where: { id: categoryId } });
  if (!category) {
    throw new ApiError(ErrorCode.VALIDATION_ERROR, 'Select a valid category.', { field: 'categoryId' });
  }
  return category;
}

/** Over-limit items are saved but flagged for the approver; no limit means never over. */
export function isOverLimit(amount: Prisma.Decimal | number, limit: Prisma.Decimal | number | null): boolean {
  return limit != null && Number(amount) > Number(limit);
}
