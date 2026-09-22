import type { ClaimItem, Receipt } from '@/types/models';
import { formatDate, formatInr } from '@/utils/format';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { ReceiptPreview } from './ReceiptPreview';
import { ReceiptUploadButton } from './ReceiptUploadButton';

interface ClaimItemsTableProps {
  items: ClaimItem[];
  receipts: Receipt[];
  total: number;
  editable?: boolean;
  onEdit?: (item: ClaimItem) => void;
  onDelete?: (item: ClaimItem) => void;
  onUploadReceipt?: (item: ClaimItem, file: File) => void;
  onRemoveReceipt?: (receipt: Receipt) => void;
  uploadingItemId?: string | null;
}

export function ClaimItemsTable({
  items,
  receipts,
  total,
  editable,
  onEdit,
  onDelete,
  onUploadReceipt,
  onRemoveReceipt,
  uploadingItemId,
}: ClaimItemsTableProps) {
  if (items.length === 0) {
    return <EmptyState title="No line items yet" description="Add at least one expense line item before submitting this claim." />;
  }

  const receiptsForItem = (itemId: string) => receipts.filter((r) => r.claimItemId === itemId);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Category</th>
            <th className="px-3 py-2">Description</th>
            <th className="px-3 py-2">Merchant</th>
            <th className="px-3 py-2 text-right">Amount</th>
            <th className="px-3 py-2">Receipt</th>
            {editable && <th className="px-3 py-2 text-right">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => {
            const itemReceipts = receiptsForItem(item.id);
            return (
              <tr key={item.id}>
                <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">{formatDate(item.expenseDate)}</td>
                <td className="px-3 py-2.5 text-slate-600">{item.category}</td>
                <td className="px-3 py-2.5 text-slate-800">{item.description}</td>
                <td className="px-3 py-2.5 text-slate-500">{item.merchant || '—'}</td>
                <td className="px-3 py-2.5 text-right font-medium text-slate-900">{formatInr(item.amount)}</td>
                <td className="px-3 py-2.5">
                  <div className="flex min-w-[160px] flex-col gap-1.5">
                    {itemReceipts.map((r) => (
                      <ReceiptPreview
                        key={r.id}
                        receipt={r}
                        onRemove={editable && onRemoveReceipt ? () => onRemoveReceipt(r) : undefined}
                      />
                    ))}
                    {editable && itemReceipts.length === 0 && onUploadReceipt && (
                      <ReceiptUploadButton
                        label="Add receipt"
                        isUploading={uploadingItemId === item.id}
                        onFile={(file) => onUploadReceipt(item, file)}
                      />
                    )}
                    {!editable && itemReceipts.length === 0 && <span className="text-xs text-slate-400">No receipt</span>}
                  </div>
                </td>
                {editable && (
                  <td className="px-3 py-2.5 text-right align-top">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => onEdit?.(item)}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => onDelete?.(item)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-200">
            <td colSpan={5} className="px-3 py-2.5 text-right text-sm font-semibold text-slate-700">
              Total
            </td>
            <td className="px-3 py-2.5 text-right text-sm font-bold text-slate-900">{formatInr(total)}</td>
            {editable && <td />}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
