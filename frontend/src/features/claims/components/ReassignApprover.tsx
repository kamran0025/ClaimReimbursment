import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ClaimDetail } from '@/types/models';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/common/ErrorState';
import { useActiveApprovers } from '@/features/claims/hooks/useClaims';
import { useBulkReassignClaims, useReassignClaim } from '@/features/claims/hooks/useClaimDecisions';
import { canReassignClaim } from '@/services/api/stateMachine';
import { useAuth } from '@/app/AuthContext';
import { useToast } from '@/app/ToastContext';

const schema = z.object({
  fromApproverId: z.string(),
  toApproverId: z.string().min(1, 'Select an approver'),
  reason: z.string().trim().max(500, 'Reason is too long'),
});
type FormValues = z.infer<typeof schema>;

interface ReassignModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  /** Approver the claim(s) currently sit with — excluded from the target list. Omit to let the user pick (Finance bulk). */
  fromApproverId?: string | null;
  isSubmitting: boolean;
  submitError: unknown;
  onSubmit: (values: { fromApproverId: string; toApproverId: string; reason?: string }) => Promise<void>;
}

function ReassignModal({ isOpen, onClose, title, description, confirmLabel, fromApproverId, isSubmitting, submitError, onSubmit }: ReassignModalProps) {
  const { data: approvers } = useActiveApprovers();
  const pickFrom = fromApproverId === undefined;
  const {
    register,
    handleSubmit,
    reset,
    control,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { fromApproverId: '', toApproverId: '', reason: '' } });
  const pickedFrom = useWatch({ control, name: 'fromApproverId' });
  const from = pickFrom ? pickedFrom : (fromApproverId ?? '');
  const close = () => {
    reset();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={close} title={title} size="md">
      <form
        onSubmit={handleSubmit(async (values) => {
          if (pickFrom && !values.fromApproverId) {
            setError('fromApproverId', { message: 'Select an approver' });
            return;
          }
          await onSubmit({ fromApproverId: from, toApproverId: values.toApproverId, reason: values.reason || undefined });
          reset();
        })}
        className="flex flex-col gap-4"
        noValidate
      >
        <p className="text-sm text-slate-600">{description}</p>
        {pickFrom && (
          <Select label="From approver" placeholder="Select an approver" error={errors.fromApproverId?.message} {...register('fromApproverId')}>
            {approvers?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        )}
        <Select label="Hand over to" placeholder="Select an approver" error={errors.toApproverId?.message} {...register('toApproverId')}>
          {approvers
            ?.filter((a) => a.id !== from)
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
        </Select>
        <Textarea
          label="Reason (optional)"
          rows={2}
          placeholder="e.g. On leave until Monday"
          error={errors.reason?.message}
          {...register('reason')}
        />
        <p className="text-xs text-slate-400">
          The new approver sees the full claim history. The claimant is only told that their approver has changed.
        </p>
        {submitError ? <ErrorState error={submitError} /> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={close} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * "Change Approver" for one claim — shown to its assigned approver and to
 * Finance while the claim is still with its approver. Renders nothing
 * otherwise, so it can sit in `ClaimDetailView`'s `actions` slot.
 */
export function ReassignClaimAction({ claim, onReassigned }: { claim: ClaimDetail; onReassigned?: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const reassign = useReassignClaim(claim.id);
  const [open, setOpen] = useState(false);

  if (!user || !canReassignClaim(claim, user)) return null;

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Change Approver
      </Button>
      <ReassignModal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Change approver"
        description={`Hand "${claim.title}" to another approver.`}
        confirmLabel="Change Approver"
        fromApproverId={claim.assignedApproverId}
        isSubmitting={reassign.isPending}
        submitError={reassign.error}
        onSubmit={async ({ toApproverId, reason }) => {
          try {
            await reassign.mutateAsync({ toApproverId, reason });
            toast.success('Approver changed');
            setOpen(false);
            onReassigned?.();
          } catch {
            // error rendered inline
          }
        }}
      />
    </>
  );
}

/**
 * Bulk handover of every claim still with an approver. An approver hands over
 * their own queue (`fromApproverId` fixed to themselves); Finance picks whose.
 */
export function BulkReassignAction({ fromApproverId, label }: { fromApproverId?: string; label: string }) {
  const toast = useToast();
  const bulk = useBulkReassignClaims();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <ReassignModal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={label}
        description="Every claim still awaiting the approver's decision (pending or awaiting the claimant's response) moves to the selected approver. Decided claims and claims already with Finance stay as they are."
        confirmLabel="Hand Over Claims"
        fromApproverId={fromApproverId}
        isSubmitting={bulk.isPending}
        submitError={bulk.error}
        onSubmit={async (values) => {
          try {
            const result = await bulk.mutateAsync({ fromApproverId: values.fromApproverId, toApproverId: values.toApproverId, reason: values.reason });
            toast.success(result.reassignedCount === 0 ? 'No open claims to hand over' : `${result.reassignedCount} claim(s) handed over`);
            setOpen(false);
          } catch {
            // error rendered inline
          }
        }}
      />
    </>
  );
}
