import { z } from 'zod';

const name = z.string().trim().min(1, 'Name is required').max(60, 'Name is too long');
const maxAmount = z.coerce
  .number({ invalid_type_error: 'Amount is required', required_error: 'Amount is required' })
  .positive('Amount must be greater than zero')
  .max(99999999.99, 'Amount is too large');

export const createCategorySchema = z.object({ name, maxAmount });
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z
  .object({ name: name.optional(), maxAmount: maxAmount.optional() })
  .refine((v) => v.name !== undefined || v.maxAmount !== undefined, { message: 'Nothing to update.' });
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
