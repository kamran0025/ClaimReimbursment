import { useState } from 'react';
import { useForm } from 'react-hook-form';
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
  /** Approver the claim(s) currently sit with — excluded from the target list. `null` when that may vary (Finance selection). */
  fromApproverId: string | null;
  isSubmitting: boolean;
  submitError: unknown;
  onSubmit: (values: { toApproverId: string; reason?: string }) => Promise<void>;
}

function ReassignModal({ isOpen, onClose, title, description, confirmLabel, fromApproverId, isSubmitting, submitError, onSubmit }: ReassignModalProps) {
  const { data: approvers } = useActiveApprovers();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { toApproverId: '', reason: '' } });
  const close = () => {
    reset();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={close} title={title} size="md">
      <form
        onSubmit={handleSubmit(async (values) => {
          await onSubmit({ toApproverId: values.toApproverId, reason: values.reason || undefined });
          reset();
        })}
        className="flex flex-col gap-4"
        noValidate
      >
        <p className="text-sm text-slate-600">{description}</p>
        <Select label="Hand over to" placeholder="Select an approver" error={errors.toApproverId?.message} {...register('toApproverId')}>
          {approvers
            ?.filter((a) => a.id !== fromApproverId)
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
 * "Change Approver" for a selection of claims — all-or-nothing on the server.
 * `fromApproverId` only drops that approver from the target list; pass `null`
 * when the selection may span approvers (Finance).
 */
export function BulkReassignAction({
  claimIds,
  fromApproverId,
  label,
  onDone,
}: {
  claimIds: string[];
  fromApproverId: string | null;
  label: string;
  onDone?: () => void;
}) {
  const toast = useToast();
  const bulk = useBulkReassignClaims();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <ReassignModal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={label}
        description={`The ${claimIds.length} selected claim(s) move to the selected approver. If any of them can no longer be reassigned, none are moved.`}
        confirmLabel="Hand Over Claims"
        fromApproverId={fromApproverId}
        isSubmitting={bulk.isPending}
        submitError={bulk.error}
        onSubmit={async ({ toApproverId, reason }) => {
          try {
            const result = await bulk.mutateAsync({ claimIds, toApproverId, reason });
            toast.success(`${result.reassignedCount} claim(s) handed over`);
            setOpen(false);
            onDone?.();
          } catch {
            // error rendered inline
          }
        }}
      />
    </>
  );
}
