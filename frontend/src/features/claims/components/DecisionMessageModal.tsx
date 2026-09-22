import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/common/ErrorState';
import type { ButtonVariant } from '@/components/ui/Button';

const schema = z.object({ message: z.string().trim().min(5, 'Please provide at least 5 characters') });
type FormValues = z.infer<typeof schema>;

interface DecisionMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (message: string) => Promise<void>;
  isSubmitting?: boolean;
  submitError?: unknown;
  title: string;
  fieldLabel: string;
  placeholder?: string;
  confirmLabel: string;
  confirmVariant?: ButtonVariant;
}

/** Shared "reason/message required" modal used for both Reject and Request Info decisions. */
export function DecisionMessageModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  submitError,
  title,
  fieldLabel,
  placeholder,
  confirmLabel,
  confirmVariant = 'primary',
}: DecisionMessageModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { message: '' } });

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        reset();
        onClose();
      }}
      title={title}
      size="md"
    >
      <form
        onSubmit={handleSubmit(async (values) => {
          await onSubmit(values.message);
        })}
        className="flex flex-col gap-4"
        noValidate
      >
        <Textarea label={fieldLabel} placeholder={placeholder} error={errors.message?.message} {...register('message')} />
        {submitError ? <ErrorState error={submitError} /> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant={confirmVariant} isLoading={isSubmitting}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
