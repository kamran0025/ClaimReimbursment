// Typed error shape a real Express backend would send in an error response
// body (spec §25): `{ success: false, error: { code, message, details? } }`.
// The mock layer throws `ApiError` instances; a real HTTP client wrapper
// would do the exact same thing after parsing a non-2xx JSON response, so
// nothing downstream (hooks/components) needs to change when the mock is
// swapped out.
import type { ApiErrorBody } from '@/types/api';

export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  FORBIDDEN_ROLE: 'FORBIDDEN_ROLE',
  CLAIM_NOT_FOUND: 'CLAIM_NOT_FOUND',
  CLAIM_NOT_OWNED: 'CLAIM_NOT_OWNED',
  CLAIM_NOT_ASSIGNED: 'CLAIM_NOT_ASSIGNED',
  CLAIM_NOT_EDITABLE: 'CLAIM_NOT_EDITABLE',
  CLAIM_EMPTY_ITEMS: 'CLAIM_EMPTY_ITEMS',
  CLAIM_TOTAL_MISMATCH: 'CLAIM_TOTAL_MISMATCH',
  CLAIM_INVALID_TRANSITION: 'CLAIM_INVALID_TRANSITION',
  CLAIM_NOT_CANCELLABLE: 'CLAIM_NOT_CANCELLABLE',
  ITEM_NOT_FOUND: 'ITEM_NOT_FOUND',
  RECEIPT_NOT_FOUND: 'RECEIPT_NOT_FOUND',
  REJECTION_REASON_REQUIRED: 'REJECTION_REASON_REQUIRED',
  INFO_REQUEST_MESSAGE_REQUIRED: 'INFO_REQUEST_MESSAGE_REQUIRED',
  INFO_RESPONSE_MESSAGE_REQUIRED: 'INFO_RESPONSE_MESSAGE_REQUIRED',
  CLAIM_NOT_PENDING_APPROVAL: 'CLAIM_NOT_PENDING_APPROVAL',
  CLAIM_NOT_INFO_REQUESTED: 'CLAIM_NOT_INFO_REQUESTED',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export class ApiError extends Error {
  code: ErrorCode;
  details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

/** Normalizes any thrown value into the backend error envelope for rendering. */
export function toErrorBody(err: unknown): ApiErrorBody {
  if (err instanceof ApiError) {
    return { success: false, error: { code: err.code, message: err.message, details: err.details } };
  }
  const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
  return { success: false, error: { code: 'INTERNAL_ERROR', message } };
}
