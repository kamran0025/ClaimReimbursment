// Mirrors frontend/src/services/api/claimsService.ts's ALLOWED_RECEIPT_MIME_TYPES /
// MAX_RECEIPT_SIZE_BYTES — enforced here server-side, not just via the
// frontend `accept` attribute (plan-backend.md §4).
export const ALLOWED_RECEIPT_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
export type AllowedReceiptMimeType = (typeof ALLOWED_RECEIPT_MIME_TYPES)[number];

export function isAllowedReceiptMimeType(mimeType: string): mimeType is AllowedReceiptMimeType {
  return (ALLOWED_RECEIPT_MIME_TYPES as readonly string[]).includes(mimeType);
}
