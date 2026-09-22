import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/common/ErrorState';
import { ReceiptUploadButton } from '@/features/claims/components/ReceiptUploadButton';
import { claimItemSchema } from '@/features/claims/schemas';
import type { ClaimItemFormValues, ClaimItemFormInput } from '@/features/claims/schemas';
import type { ClaimItem } from '@/types/models';
import { formatFileSize } from '@/utils/format';

const CATEGORIES = ['Travel', 'Lodging', 'Meals', 'Training', 'Supplies', 'Software', 'Client Entertainment', 'Other'];

interface ClaimItemFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: ClaimItemFormValues, receiptFile: File | null) => Promise<void>;
  initialItem?: ClaimItem | null;
  isSubmitting?: boolean;
  submitError?: unknown;
}

export function ClaimItemFormModal({ isOpen, onClose, onSubmit, initialItem, isSubmitting, submitError }: ClaimItemFormModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ClaimItemFormInput, unknown, ClaimItemFormValues>({
    resolver: zodResolver(claimItemSchema),
    defaultValues: { expenseDate: '', category: '', description: '', amount: 0, merchant: '' },
  });

  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  useEffect(() => {
    if (isOpen) {
      reset(
        initialItem
          ? {
              expenseDate: initialItem.expenseDate.slice(0, 10),
              category: initialItem.category,
              description: initialItem.description,
              amount: initialItem.amount,
              merchant: initialItem.merchant ?? '',
            }
          : { expenseDate: new Date().toISOString().slice(0, 10), category: '', description: '', amount: 0, merchant: '' },
      );
      setReceiptFile(null);
    }
  }, [isOpen, initialItem, reset]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialItem ? 'Edit line item' : 'Add line item'} size="md">
      <form
        onSubmit={handleSubmit(async (values) => {
          await onSubmit(values, receiptFile);
        })}
        className="flex flex-col gap-4"
        noValidate
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Expense date" type="date" error={errors.expenseDate?.message} {...register('expenseDate')} />
          <Select label="Category" placeholder="Select a category" error={errors.category?.message} {...register('category')}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        <Input label="Description" placeholder="e.g. Client dinner in Bangalore" error={errors.description?.message} {...register('description')} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Amount (INR)" type="number" step="0.01" min="0" error={errors.amount?.message} {...register('amount')} />
          <Input label="Merchant (optional)" placeholder="e.g. IndiGo" {...register('merchant')} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-700">Receipt (optional)</span>
          <div className="flex items-center gap-2">
            <ReceiptUploadButton
              label={receiptFile ? 'Replace file' : 'Attach receipt'}
              onFile={setReceiptFile}
            />
            {receiptFile && (
              <span className="flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
                <span className="min-w-0 truncate">{receiptFile.name}</span>
                <span className="shrink-0 text-slate-400">({formatFileSize(receiptFile.size)})</span>
                <button
                  type="button"
                  className="shrink-0 text-slate-400 hover:text-red-600"
                  onClick={() => setReceiptFile(null)}
                >
                  Remove
                </button>
              </span>
            )}
          </div>
          <span className="text-xs text-slate-400">JPEG, PNG, WEBP, or PDF — up to 5MB.</span>
        </div>
        {submitError ? <ErrorState error={submitError} /> : null}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            {initialItem ? 'Save changes' : 'Add item'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
