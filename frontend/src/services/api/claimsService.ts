// Claim CRUD, line items, receipts, submit/resubmit/cancel, and the direct
// approve/reject/request-info/respond-info decision actions — thin wrappers
// over the real backend's REST endpoints (backend/API.md). All business
// rules (ownership, state-machine guards, server-side total recalculation,
// authorization scoping) are enforced server-side now; this file's only job
// is shaping requests and responses to match what it looked like when this
// was a mock (same exported names, params, return shapes, thrown-error
// shape — see `services/api/index.ts`'s "one boundary" comment).
import { ClaimStatus } from '@/types/enums';
import type { Claim, ClaimDetail, ClaimMessage, Receipt } from '@/types/models';
import type { PageParams, Paginated } from '@/types/api';
import { apiDelete, apiGet, apiPatch, apiPost, API_BASE_URL } from './httpClient';

// The backend returns `Receipt.url` as a path relative to itself
// (`/claims/:claimId/receipts/:id`) — make it absolute so `<img src>`/`<a
// href>` in the UI resolve against the API origin, not the SPA's own.
// (This is a normal same-site cross-port request in dev, so the auth
// cookie still rides along with it — no extra fetch/blob plumbing needed.)
function absolutizeReceipt(receipt: Receipt): Receipt {
  return { ...receipt, url: receipt.url.startsWith('http') ? receipt.url : `${API_BASE_URL}${receipt.url}` };
}

function absolutizeMessage(message: ClaimMessage): ClaimMessage {
  return { ...message, attachedReceipt: message.attachedReceipt ? absolutizeReceipt(message.attachedReceipt) : message.attachedReceipt };
}

function normalizeClaimDetail(detail: ClaimDetail): ClaimDetail {
  return {
    ...detail,
    receipts: detail.receipts.map(absolutizeReceipt),
    messages: detail.messages.map(absolutizeMessage),
  };
}

export interface ClaimFilters {
  status?: ClaimStatus | ClaimStatus[];
  claimantId?: string;
  assignedApproverId?: string;
  decidedById?: string;
  dateFrom?: string;
  dateTo?: string;
  amountMin?: number;
  amountMax?: number;
  search?: string;
}

export async function listClaims(filters?: ClaimFilters, page?: PageParams): Promise<Paginated<Claim>> {
  return apiGet<Paginated<Claim>>('/claims', {
    status: filters?.status,
    claimantId: filters?.claimantId,
    assignedApproverId: filters?.assignedApproverId,
    decidedById: filters?.decidedById,
    dateFrom: filters?.dateFrom,
    dateTo: filters?.dateTo,
    amountMin: filters?.amountMin,
    amountMax: filters?.amountMax,
    search: filters?.search,
    page: page?.page,
    pageSize: page?.pageSize,
  });
}

export async function getClaim(claimId: string): Promise<ClaimDetail> {
  return normalizeClaimDetail(await apiGet<ClaimDetail>(`/claims/${claimId}`));
}

export interface CreateClaimInput {
  title: string;
}

export async function createClaim(input: CreateClaimInput): Promise<ClaimDetail> {
  return normalizeClaimDetail(await apiPost<ClaimDetail>('/claims', input));
}

export interface UpdateClaimInput {
  title?: string;
}

export async function updateClaim(claimId: string, input: UpdateClaimInput): Promise<ClaimDetail> {
  return normalizeClaimDetail(await apiPatch<ClaimDetail>(`/claims/${claimId}`, input));
}

export interface ClaimItemInput {
  expenseDate: string;
  category: string;
  description: string;
  amount: number;
  merchant?: string;
}

export async function addItem(claimId: string, input: ClaimItemInput): Promise<ClaimDetail> {
  return normalizeClaimDetail(await apiPost<ClaimDetail>(`/claims/${claimId}/items`, input));
}

export async function updateItem(claimId: string, itemId: string, input: ClaimItemInput): Promise<ClaimDetail> {
  return normalizeClaimDetail(await apiPatch<ClaimDetail>(`/claims/${claimId}/items/${itemId}`, input));
}

export async function deleteItem(claimId: string, itemId: string): Promise<ClaimDetail> {
  return normalizeClaimDetail(await apiDelete<ClaimDetail>(`/claims/${claimId}/items/${itemId}`));
}

// ---------------------------------------------------------------------------
// Receipts
// ---------------------------------------------------------------------------
export interface ReceiptInput {
  file: File;
  claimItemId?: string | null;
}

function receiptFormData(input: ReceiptInput): FormData {
  const formData = new FormData();
  formData.append('file', input.file);
  if (input.claimItemId) formData.append('claimItemId', input.claimItemId);
  return formData;
}

export async function addReceipt(claimId: string, input: ReceiptInput): Promise<ClaimDetail> {
  return normalizeClaimDetail(await apiPost<ClaimDetail>(`/claims/${claimId}/receipts`, receiptFormData(input)));
}

export async function deleteReceipt(claimId: string, receiptId: string): Promise<ClaimDetail> {
  return normalizeClaimDetail(await apiDelete<ClaimDetail>(`/claims/${claimId}/receipts/${receiptId}`));
}

// ---------------------------------------------------------------------------
// Submit / resubmit / cancel
// ---------------------------------------------------------------------------
export async function submitClaim(claimId: string, assignedApproverId: string): Promise<ClaimDetail> {
  return normalizeClaimDetail(await apiPost<ClaimDetail>(`/claims/${claimId}/submit`, { assignedApproverId }));
}

export async function resubmitClaim(claimId: string, assignedApproverId: string): Promise<ClaimDetail> {
  return normalizeClaimDetail(await apiPost<ClaimDetail>(`/claims/${claimId}/resubmit`, { assignedApproverId }));
}

export async function cancelClaim(claimId: string): Promise<ClaimDetail> {
  return normalizeClaimDetail(await apiPost<ClaimDetail>(`/claims/${claimId}/cancel`));
}

// ---------------------------------------------------------------------------
// Decisions — approve / reject / request-info (assigned approver OR
// Finance), and respond-info (claimant only).
// ---------------------------------------------------------------------------
export async function approveClaim(claimId: string): Promise<ClaimDetail> {
  return normalizeClaimDetail(await apiPost<ClaimDetail>(`/claims/${claimId}/approve`));
}

export async function rejectClaim(claimId: string, reason: string): Promise<ClaimDetail> {
  return normalizeClaimDetail(await apiPost<ClaimDetail>(`/claims/${claimId}/reject`, { reason }));
}

export async function requestInfo(claimId: string, message: string): Promise<ClaimDetail> {
  return normalizeClaimDetail(await apiPost<ClaimDetail>(`/claims/${claimId}/request-info`, { message }));
}

export interface RespondToInfoRequestInput {
  message: string;
  receiptFile?: File | null;
}

/**
 * The real backend keeps this as two REST calls (upload the receipt, then
 * post the response referencing it) rather than one combined endpoint —
 * see backend/API.md's integration note. This orchestrates both so the
 * exported signature/return shape stays identical to when this was a
 * single mock call.
 */
export async function respondToInfoRequest(claimId: string, input: RespondToInfoRequestInput): Promise<ClaimDetail> {
  let attachedReceiptId: string | undefined;
  if (input.receiptFile) {
    const withReceipt = await addReceipt(claimId, { file: input.receiptFile, claimItemId: null });
    attachedReceiptId = withReceipt.receipts[withReceipt.receipts.length - 1]?.id;
  }
  return normalizeClaimDetail(await apiPost<ClaimDetail>(`/claims/${claimId}/respond-info`, { message: input.message, attachedReceiptId }));
}
