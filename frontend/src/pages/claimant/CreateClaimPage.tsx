import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/common/ErrorState';
import { useToast } from '@/app/ToastContext';
import { useCreateClaim } from '@/features/claims/hooks/useClaimMutations';
import { claimTitleSchema } from '@/features/claims/schemas';
import type { ClaimTitleFormValues } from '@/features/claims/schemas';

export function CreateClaimPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const createClaim = useCreateClaim();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ClaimTitleFormValues>({ resolver: zodResolver(claimTitleSchema), defaultValues: { title: '' } });

  const onSubmit = async (values: ClaimTitleFormValues) => {
    try {
      const claim = await createClaim.mutateAsync(values);
      toast.success('Draft created', 'Now add your expense line items.');
      navigate(`/claimant/claims/${claim.id}/edit`);
    } catch {
      // surfaced via createClaim.error below
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="New Claim" subtitle="Start a new expense claim. You can add line items on the next step." />
      <Card>
        <CardBody>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
            <Input
              label="Claim title"
              placeholder="e.g. Client visit - Mumbai"
              error={errors.title?.message}
              {...register('title')}
            />
            {createClaim.isError ? <ErrorState error={createClaim.error} /> : null}
            <div className="flex justify-end">
              <Button type="submit" isLoading={createClaim.isPending}>
                Continue
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
