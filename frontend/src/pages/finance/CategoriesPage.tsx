import { useState } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/ErrorState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Table } from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useToast } from '@/app/ToastContext';
import { useCategories, useCreateCategory, useDeleteCategory, useUpdateCategory } from '@/features/categories/hooks/useCategories';
import { CategoryFormModal } from '@/features/categories/components/CategoryFormModal';
import type { CategoryFormValues } from '@/features/claims/schemas';
import { formatDate, formatInr } from '@/utils/format';
import type { ExpenseCategory } from '@/types/models';

export function CategoriesPage() {
  const toast = useToast();
  const { data, isLoading, isError, error, refetch } = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  // `null` = closed, `{ category: null }` = adding, `{ category }` = editing.
  const [formModal, setFormModal] = useState<{ category: ExpenseCategory | null } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseCategory | null>(null);

  const openForm = (category: ExpenseCategory | null) => {
    createCategory.reset();
    updateCategory.reset();
    setFormModal({ category });
  };

  const handleSubmit = async (values: CategoryFormValues) => {
    const editing = formModal?.category;
    try {
      if (editing) {
        await updateCategory.mutateAsync({ categoryId: editing.id, input: values });
        toast.success('Category updated');
      } else {
        await createCategory.mutateAsync(values);
        toast.success('Category added');
      }
      setFormModal(null);
    } catch {
      // Shown inside the modal via submitError.
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCategory.mutateAsync(deleteTarget.id);
      toast.success('Category deleted');
    } catch (err) {
      toast.error('Could not delete category', err instanceof Error ? err.message : undefined);
    } finally {
      setDeleteTarget(null);
    }
  };

  const columns: Column<ExpenseCategory>[] = [
    { key: 'name', header: 'Name', render: (c) => <span className="font-medium text-slate-800">{c.name}</span> },
    {
      key: 'amount',
      header: 'Amount',
      render: (c) => (c.maxAmount != null ? formatInr(c.maxAmount) : <span className="text-slate-400">Not set</span>),
    },
    { key: 'updated', header: 'Last updated', render: (c) => formatDate(c.updatedAt) },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      headerClassName: 'text-right',
      className: 'text-right',
      render: (c) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => openForm(c)}>
            Edit
          </Button>
          <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => setDeleteTarget(c)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const editing = formModal?.category ?? null;

  return (
    <div>
      <PageHeader
        title="Expense Categories"
        subtitle="Categories claimants can choose for line items."
        actions={<Button onClick={() => openForm(null)}>Add category</Button>}
      />
      <Card>
        {isLoading && <SkeletonRows rows={6} cols={4} />}
        {isError && (
          <div className="p-4">
            <ErrorState error={error} onRetry={() => refetch()} />
          </div>
        )}
        {data && data.length === 0 && <EmptyState title="No categories yet" description="Add the first category claimants can use." />}
        {data && data.length > 0 && <Table columns={columns} rows={data} rowKey={(c) => c.id} />}
      </Card>

      <CategoryFormModal
        isOpen={formModal !== null}
        onClose={() => setFormModal(null)}
        onSubmit={handleSubmit}
        initialCategory={editing}
        isSubmitting={editing ? updateCategory.isPending : createCategory.isPending}
        submitError={editing ? updateCategory.error : createCategory.error}
      />

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Delete category?"
        message={`"${deleteTarget?.name ?? ''}" will be removed permanently. Categories already used by line items can't be deleted.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        isLoading={deleteCategory.isPending}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
