import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/common/ErrorState';
import { categorySchema } from '@/features/claims/schemas';
import type { CategoryFormInput, CategoryFormValues } from '@/features/claims/schemas';
import type { ExpenseCategory } from '@/types/models';

interface CategoryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: CategoryFormValues) => Promise<void>;
  initialCategory?: ExpenseCategory | null;
  isSubmitting?: boolean;
  submitError?: unknown;
}

export function CategoryFormModal({ isOpen, onClose, onSubmit, initialCategory, isSubmitting, submitError }: CategoryFormModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CategoryFormInput, unknown, CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '', maxAmount: '' },
  });

  useEffect(() => {
    if (isOpen) reset({ name: initialCategory?.name ?? '', maxAmount: initialCategory?.maxAmount ?? '' });
  }, [isOpen, initialCategory, reset]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialCategory ? 'Edit category' : 'Add category'} size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <Input label="Name" placeholder="e.g. Internet & Phone" error={errors.name?.message} {...register('name')} />
        <Input
          label="Amount (INR)"
          type="number"
          step="0.01"
          min="0"
          placeholder="e.g. 1500"
          error={errors.maxAmount?.message}
          {...register('maxAmount')}
        />
        {initialCategory && (
          <p className="text-xs text-slate-500">Renaming also changes the category shown on existing line items.</p>
        )}
        {submitError ? <ErrorState error={submitError} /> : null}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            {initialCategory ? 'Save changes' : 'Add category'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
