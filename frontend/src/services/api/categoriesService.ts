// Expense categories. Anyone can list them (the line-item picker); creating,
// editing and deleting is Finance-only, enforced by the backend.
import type { ExpenseCategory } from '@/types/models';
import { apiDelete, apiGet, apiPatch, apiPost } from './httpClient';

export async function listCategories(): Promise<ExpenseCategory[]> {
  return apiGet<ExpenseCategory[]>('/categories');
}

export interface CreateCategoryInput {
  name: string;
  maxAmount: number;
}

export async function createCategory(input: CreateCategoryInput): Promise<ExpenseCategory> {
  return apiPost<ExpenseCategory>('/categories', input);
}

export type UpdateCategoryInput = Partial<CreateCategoryInput>;

export async function updateCategory(categoryId: string, input: UpdateCategoryInput): Promise<ExpenseCategory> {
  return apiPatch<ExpenseCategory>(`/categories/${categoryId}`, input);
}

/** Fails with `CATEGORY_IN_USE` while any line item uses the category. */
export async function deleteCategory(categoryId: string): Promise<void> {
  await apiDelete<{ id: string }>(`/categories/${categoryId}`);
}
