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
  categoryId: z.string().trim().min(1, 'Category is required'),
  description: z.string().trim().min(1, 'Description is required').max(300, 'Description is too long'),
  amount: z.coerce.number({ invalid_type_error: 'Amount is required', required_error: 'Amount is required' }),
  merchant: z.string().trim().optional(),
});
export type ClaimItemInput = z.infer<typeof claimItemSchema>;

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

const reassignFields = {
  toApproverId: z.string().trim().min(1, 'Select the approver to hand the claim to.'),
  reason: z.string().trim().max(500, 'Reason is too long').optional(),
};

export const reassignClaimSchema = z.object(reassignFields);
export type ReassignClaimInput = z.infer<typeof reassignClaimSchema>;

// Either an explicit selection of claims, or every open claim of one approver
// (`fromApproverId`, defaulting to the caller for an approver handing over their own queue).
export const bulkReassignClaimsSchema = z
  .object({
    ...reassignFields,
    claimIds: z.array(z.string().trim().min(1)).min(1, 'Select at least one claim.').max(100, 'At most 100 claims at a time.').optional(),
    fromApproverId: z.string().trim().min(1).optional(),
  })
  .refine((v) => !(v.claimIds && v.fromApproverId), { message: 'Pass either claimIds or fromApproverId, not both.', path: ['claimIds'] });
export type BulkReassignClaimsInput = z.infer<typeof bulkReassignClaimsSchema>;

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
