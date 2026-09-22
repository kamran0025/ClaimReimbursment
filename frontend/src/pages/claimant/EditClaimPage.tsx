import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/ErrorState';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { PageSpinner } from '@/components/ui/Spinner';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { ClaimStatusBadge } from '@/components/common/StatusBadge';
import { useToast } from '@/app/ToastContext';
import { useClaim, useActiveApprovers } from '@/features/claims/hooks/useClaims';
import {
  useAddItem,
  useUpdateItem,
  useDeleteItem,
  useAddReceipt,
  useDeleteReceipt,
  useSubmitClaim,
  useResubmitClaim,
  useCancelClaim,
  useUpdateClaim,
} from '@/features/claims/hooks/useClaimMutations';
import { ClaimItemsTable } from '@/features/claims/components/ClaimItemsTable';
import { ClaimItemFormModal } from '@/features/claims/components/ClaimItemFormModal';
import { claimTitleSchema } from '@/features/claims/schemas';
import type { ClaimTitleFormValues } from '@/features/claims/schemas';
import type { ClaimItem } from '@/types/models';
import { isEditableStatus } from '@/services/api/stateMachine';

export function EditClaimPage() {
  const { claimId } = useParams<{ claimId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: claim, isLoading, isError, error, refetch } = useClaim(claimId);
  const { data: approvers } = useActiveApprovers();

  const [itemModal, setItemModal] = useState<{ open: boolean; item: ClaimItem | null }>({ open: false, item: null });
  const [deleteTarget, setDeleteTarget] = useState<ClaimItem | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [selectedApproverId, setSelectedApproverId] = useState<string>('');
  const [approverTouched, setApproverTouched] = useState(false);

  const addItem = useAddItem(claimId ?? '');
  const updateItem = useUpdateItem(claimId ?? '');
  const deleteItem = useDeleteItem(claimId ?? '');
  const addReceipt = useAddReceipt(claimId ?? '');
  const deleteReceipt = useDeleteReceipt(claimId ?? '');
  const submitClaim = useSubmitClaim(claimId ?? '');
  const resubmitClaim = useResubmitClaim(claimId ?? '');
  const cancelClaim = useCancelClaim(claimId ?? '');
  const updateClaim = useUpdateClaim(claimId ?? '');

  const {
    register: registerTitle,
    handleSubmit: handleTitleSubmit,
    formState: { errors: titleErrors, isDirty: titleDirty },
  } = useForm<ClaimTitleFormValues>({
    resolver: zodResolver(claimTitleSchema),
    values: claim ? { title: claim.title } : undefined,
  });

  if (isLoading) return <PageSpinner />;
  if (isError || !claim) return <ErrorState error={error} onRetry={() => refetch()} />;

  const editable = isEditableStatus(claim.status);
  const isResubmit = claim.status === 'REJECTED';
  const effectiveApproverId = selectedApproverId || claim.assignedApproverId || '';

  const onSaveTitle = async (values: ClaimTitleFormValues) => {
    try {
      await updateClaim.mutateAsync(values);
      toast.success('Title updated');
    } catch (err) {
      toast.error('Could not update title', err instanceof Error ? err.message : undefined);
    }
  };

  const handleItemSubmit = async (
    values: { expenseDate: string; category: string; description: string; amount: number; merchant?: string },
    receiptFile: File | null,
  ) => {
    try {
      if (itemModal.item) {
        const itemId = itemModal.item.id;
        await updateItem.mutateAsync({ itemId, input: values });
        if (receiptFile) {
          try {
            await addReceipt.mutateAsync({ file: receiptFile, claimItemId: itemId });
          } catch (err) {
            toast.error('Item saved, but receipt upload failed', err instanceof Error ? err.message : undefined);
          }
        }
        toast.success('Line item updated');
      } else {
        const prevItemIds = new Set(claim.items.map((i) => i.id));
        const updated = await addItem.mutateAsync(values);
        if (receiptFile) {
          const newItem = updated.items.find((i) => !prevItemIds.has(i.id));
          try {
            if (!newItem) throw new Error('Could not locate the newly added line item.');
            await addReceipt.mutateAsync({ file: receiptFile, claimItemId: newItem.id });
          } catch (err) {
            toast.error('Item added, but receipt upload failed', err instanceof Error ? err.message : undefined);
          }
        }
        toast.success('Line item added');
      }
      setItemModal({ open: false, item: null });
    } catch {
      // error rendered inline via mutation state
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteItem.mutateAsync(deleteTarget.id);
      toast.success('Line item deleted');
    } catch (err) {
      toast.error('Could not delete item', err instanceof Error ? err.message : undefined);
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleUploadReceipt = async (item: ClaimItem, file: File) => {
    setUploadingItemId(item.id);
    try {
      await addReceipt.mutateAsync({ file, claimItemId: item.id });
      toast.success('Receipt attached');
    } catch (err) {
      toast.error('Could not attach receipt', err instanceof Error ? err.message : undefined);
    } finally {
      setUploadingItemId(null);
    }
  };

  const doSubmit = async () => {
    if (!effectiveApproverId) {
      setApproverTouched(true);
      setConfirmSubmit(false);
      return;
    }
    try {
      if (isResubmit) {
        await resubmitClaim.mutateAsync(effectiveApproverId);
        toast.success('Claim resubmitted', 'It is back with the assigned approver.');
      } else {
        await submitClaim.mutateAsync(effectiveApproverId);
        toast.success('Claim submitted', 'It is now awaiting approval.');
      }
      setConfirmSubmit(false);
      navigate(`/claimant/claims/${claim.id}`);
    } catch (err) {
      toast.error('Could not submit claim', err instanceof Error ? err.message : undefined);
      setConfirmSubmit(false);
    }
  };

  const doCancel = async () => {
    try {
      await cancelClaim.mutateAsync();
      toast.success('Claim cancelled');
      setConfirmCancel(false);
      navigate(`/claimant/claims/${claim.id}`);
    } catch (err) {
      toast.error('Could not cancel claim', err instanceof Error ? err.message : undefined);
      setConfirmCancel(false);
    }
  };

  const submitMutation = isResubmit ? resubmitClaim : submitClaim;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            Edit Claim <ClaimStatusBadge status={claim.status} />
          </span>
        }
        subtitle={`Submission cycle #${claim.submissionCycle}`}
      />

      {!editable && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This claim is <strong>{claim.status}</strong> and can no longer be edited. Viewing in read-only mode.
        </div>
      )}

      {claim.status === 'REJECTED' && claim.rejectionReason && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>Rejected:</strong> {claim.rejectionReason}
        </div>
      )}

      <Card className="mb-4">
        <CardHeader title="Claim details" />
        <CardBody>
          <form onSubmit={handleTitleSubmit(onSaveTitle)} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Input label="Title" disabled={!editable} error={titleErrors.title?.message} {...registerTitle('title')} />
            </div>
            {editable && (
              <Button type="submit" variant="outline" isLoading={updateClaim.isPending} disabled={!titleDirty}>
                Save title
              </Button>
            )}
          </form>
        </CardBody>
      </Card>

      <Card className="mb-4">
        <CardHeader
          title="Line items"
          action={editable ? <Button size="sm" onClick={() => setItemModal({ open: true, item: null })}>Add item</Button> : undefined}
        />
        <CardBody>
          <ClaimItemsTable
            items={claim.items}
            receipts={claim.receipts}
            total={claim.total}
            editable={editable}
            onEdit={(item) => setItemModal({ open: true, item })}
            onDelete={(item) => setDeleteTarget(item)}
            onUploadReceipt={handleUploadReceipt}
            onRemoveReceipt={async (receipt) => {
              try {
                await deleteReceipt.mutateAsync(receipt.id);
                toast.success('Receipt removed');
              } catch (err) {
                toast.error('Could not remove receipt', err instanceof Error ? err.message : undefined);
              }
            }}
            uploadingItemId={uploadingItemId}
          />
        </CardBody>
      </Card>

      {editable && (
        <Card className="mb-4">
          <CardHeader title="Assign approver" subtitle="Required to submit — not required while saving as a draft." />
          <CardBody>
            <Select
              label="Approver"
              placeholder="Select an approver"
              value={effectiveApproverId}
              onChange={(e) => {
                setSelectedApproverId(e.target.value);
                setApproverTouched(true);
              }}
              error={approverTouched && !effectiveApproverId ? 'Select an approver before submitting.' : undefined}
            >
              {approvers?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.email})
                </option>
              ))}
            </Select>
          </CardBody>
        </Card>
      )}

      {editable && (
        <div className="flex flex-wrap justify-end gap-2">
          {claim.status === 'DRAFT' && (
            <Button variant="outline" className="text-red-600" onClick={() => setConfirmCancel(true)}>
              Cancel Claim
            </Button>
          )}
          <Button
            onClick={() => {
              setApproverTouched(true);
              if (effectiveApproverId) setConfirmSubmit(true);
            }}
            disabled={claim.items.length === 0}
          >
            {isResubmit ? 'Resubmit for Approval' : 'Submit for Approval'}
          </Button>
        </div>
      )}
      {editable && claim.items.length === 0 && (
        <p className="mt-2 text-right text-xs text-slate-400">Add at least one line item before submitting.</p>
      )}

      <ClaimItemFormModal
        isOpen={itemModal.open}
        onClose={() => setItemModal({ open: false, item: null })}
        onSubmit={handleItemSubmit}
        initialItem={itemModal.item}
        isSubmitting={addItem.isPending || updateItem.isPending}
        submitError={addItem.error ?? updateItem.error}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete line item"
        message={`Delete "${deleteTarget?.description}"? This cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        isLoading={deleteItem.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        isOpen={confirmSubmit}
        title={isResubmit ? 'Resubmit claim' : 'Submit claim'}
        message="Once submitted, this claim will be locked for editing until it is approved, rejected, or an info request is answered. Continue?"
        confirmLabel={isResubmit ? 'Resubmit' : 'Submit'}
        isLoading={submitMutation.isPending}
        onConfirm={doSubmit}
        onCancel={() => setConfirmSubmit(false)}
      />

      <ConfirmDialog
        isOpen={confirmCancel}
        title="Cancel claim"
        message="This will cancel the claim permanently. This cannot be undone."
        confirmLabel="Cancel Claim"
        confirmVariant="danger"
        isLoading={cancelClaim.isPending}
        onConfirm={doCancel}
        onCancel={() => setConfirmCancel(false)}
      />
    </div>
  );
}
