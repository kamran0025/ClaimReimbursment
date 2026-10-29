import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/common/ErrorState';
import { ReceiptUploadButton } from '@/features/claims/components/ReceiptUploadButton';
import { useCategories } from '@/features/categories/hooks/useCategories';
import { claimItemSchema } from '@/features/claims/schemas';
import type { ClaimItemFormValues, ClaimItemFormInput } from '@/features/claims/schemas';
import type { ClaimItem } from '@/types/models';
import { formatFileSize, formatInr } from '@/utils/format';

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
    control,
    formState: { errors },
  } = useForm<ClaimItemFormInput, unknown, ClaimItemFormValues>({
    resolver: zodResolver(claimItemSchema),
    defaultValues: { expenseDate: '', categoryId: '', description: '', amount: 0, merchant: '' },
  });

  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const categories = useCategories();
  // The item's own category must be an option before the list loads, so `reset` can select it.
  const categoryOptions: { id: string; name: string }[] = (categories.data ?? []).map((c) => ({ id: c.id, name: c.name }));
  if (initialItem && !categoryOptions.some((c) => c.id === initialItem.categoryId)) {
    categoryOptions.push({ id: initialItem.categoryId, name: initialItem.category });
  }

  // Mirrors the backend's check so the claimant knows before saving; the item still saves when over.
  const [watchedCategoryId, watchedAmount] = useWatch({ control, name: ['categoryId', 'amount'] });
  const selectedCategory = categories.data?.find((c) => c.id === watchedCategoryId);
  const limit = selectedCategory?.maxAmount ?? null;
  const enteredAmount = Number(watchedAmount);
  const isOverLimit = limit != null && enteredAmount > limit;

  useEffect(() => {
    if (isOpen) {
      reset(
        initialItem
          ? {
              expenseDate: initialItem.expenseDate.slice(0, 10),
              categoryId: initialItem.categoryId,
              description: initialItem.description,
              amount: initialItem.amount,
              merchant: initialItem.merchant ?? '',
            }
          : { expenseDate: new Date().toISOString().slice(0, 10), categoryId: '', description: '', amount: 0, merchant: '' },
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
          <Select
            label="Category"
            placeholder={categories.isLoading ? 'Loading categories…' : 'Select a category'}
            error={errors.categoryId?.message ?? (categories.isError ? 'Could not load categories' : undefined)}
            {...register('categoryId')}
          >
            {categoryOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <Input label="Description" placeholder="e.g. Client dinner in Bangalore" error={errors.description?.message} {...register('description')} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Amount (INR)" type="number" step="0.01" min="0" error={errors.amount?.message} {...register('amount')} />
          <Input label="Merchant (optional)" placeholder="e.g. IndiGo" {...register('merchant')} />
        </div>
        {selectedCategory && limit != null && !isOverLimit && (
          <p className="-mt-2 text-xs text-slate-500">
            Limit for {selectedCategory.name}: {formatInr(limit)} per item.
          </p>
        )}
        {selectedCategory && isOverLimit && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            This amount is above the {formatInr(limit)} limit for {selectedCategory.name}. You can still save it, but it will be
            flagged for your approver — use the description to explain why.
          </div>
        )}
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
