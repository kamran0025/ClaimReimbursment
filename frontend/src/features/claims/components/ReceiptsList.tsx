import type { Receipt } from '@/types/models';
import { ReceiptPreview } from './ReceiptPreview';

/**
 * Read-only receipt display. Used for "additional" receipts not tied to a
 * specific line item (e.g. attached while responding to an info request) —
 * per-item receipts render inline in `ClaimItemsTable` instead.
 */
export function ReceiptsList({ receipts }: { receipts: Receipt[] }) {
  if (receipts.length === 0) {
    return <p className="text-sm text-slate-400">No additional receipts attached.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {receipts.map((r) => (
        <ReceiptPreview key={r.id} receipt={r} />
      ))}
    </div>
  );
}
