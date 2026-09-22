import { z } from 'zod';

export const claimTitleSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title is too long'),
});
export type ClaimTitleFormValues = z.infer<typeof claimTitleSchema>;

export const claimItemSchema = z.object({
  expenseDate: z
    .string()
    .min(1, 'Expense date is required')
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date')
    .refine((v) => new Date(v).getTime() <= Date.now() + 24 * 60 * 60 * 1000, 'Date cannot be in the future'),
  category: z.string().trim().min(1, 'Category is required'),
  description: z.string().trim().min(1, 'Description is required').max(300, 'Description is too long'),
  amount: z.coerce.number({ error: 'Amount is required' }).positive('Amount must be greater than zero'),
  merchant: z.string().trim().optional(),
});
export type ClaimItemFormValues = z.infer<typeof claimItemSchema>;
/** Pre-coercion shape RHF's `register`/`defaultValues` actually work with (amount arrives as a string from the input). */
export type ClaimItemFormInput = z.input<typeof claimItemSchema>;

export const rejectReasonSchema = z.object({
  reason: z.string().trim().min(5, 'Please provide a reason of at least 5 characters'),
});
export type RejectReasonFormValues = z.infer<typeof rejectReasonSchema>;

export const infoRequestSchema = z.object({
  message: z.string().trim().min(5, 'Please describe what you need in at least 5 characters'),
});
export type InfoRequestFormValues = z.infer<typeof infoRequestSchema>;

export const respondInfoSchema = z.object({
  message: z.string().trim().min(2, 'Please enter a response'),
});
export type RespondInfoFormValues = z.infer<typeof respondInfoSchema>;
