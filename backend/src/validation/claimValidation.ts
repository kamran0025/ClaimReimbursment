import { z } from 'zod';

// `total` is deliberately not part of any input schema — plan-backend.md §4.1:
// clients can never set it, and any client-supplied value in a raw body is
// simply never read (Zod's default `.strip()` behavior drops unknown keys).

export const createClaimSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title is too long'),
});
export type CreateClaimInput = z.infer<typeof createClaimSchema>;

export const updateClaimSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title is too long').optional(),
});
export type UpdateClaimInput = z.infer<typeof updateClaimSchema>;

export const claimItemSchema = z.object({
  expenseDate: z.string().min(1, 'Expense date is required'),
  category: z.string().trim().min(1, 'Category is required'),
  description: z.string().trim().min(1, 'Description is required').max(300, 'Description is too long'),
  amount: z.coerce.number({ invalid_type_error: 'Amount is required', required_error: 'Amount is required' }),
  merchant: z.string().trim().optional(),
});
export type ClaimItemInput = z.infer<typeof claimItemSchema>;

export const submitClaimSchema = z.object({
  assignedApproverId: z.string().trim().min(1, 'Select an approver before submitting.'),
});
export type SubmitClaimInput = z.infer<typeof submitClaimSchema>;

export const rejectClaimSchema = z.object({
  reason: z.string().trim().min(1, 'A rejection reason is required.'),
});
export type RejectClaimInput = z.infer<typeof rejectClaimSchema>;

export const requestInfoSchema = z.object({
  message: z.string().trim().min(1, 'A message is required to request more information.'),
});
export type RequestInfoInput = z.infer<typeof requestInfoSchema>;

export const respondInfoSchema = z.object({
  message: z.string().trim().min(1, 'A response message is required.'),
  attachedReceiptId: z.string().trim().min(1).optional().nullable(),
});
export type RespondInfoInput = z.infer<typeof respondInfoSchema>;

export const listClaimsQuerySchema = z.object({
  status: z.union([z.string(), z.array(z.string())]).optional(),
  claimantId: z.string().optional(),
  assignedApproverId: z.string().optional(),
  decidedById: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  amountMin: z.coerce.number().optional(),
  amountMax: z.coerce.number().optional(),
  search: z.string().optional(),
  page: z.coerce.number().optional(),
  pageSize: z.coerce.number().optional(),
});
export type ListClaimsQuery = z.infer<typeof listClaimsQuerySchema>;
