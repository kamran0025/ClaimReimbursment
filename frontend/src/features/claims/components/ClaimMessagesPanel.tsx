import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ClaimDetail, User } from '@/types/models';
import { Role } from '@/types/enums';
import { isInReview } from '@/services/api/stateMachine';
import { Card, CardHeader } from '@/components/ui/Card';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/common/ErrorState';
import { MessageThread } from './MessageThread';
import { ReceiptPreview } from './ReceiptPreview';
import { ReceiptUploadButton } from './ReceiptUploadButton';
import { useRequestInfo, useRespondToInfoRequest } from '@/features/claims/hooks/useClaimDecisions';
import { infoRequestSchema, respondInfoSchema } from '@/features/claims/schemas';
import type { InfoRequestFormValues, RespondInfoFormValues } from '@/features/claims/schemas';
import { useAuth } from '@/app/AuthContext';
import { useToast } from '@/app/ToastContext';

/** Reply box for the claimant, shown only while the claim is INFO_REQUESTED. */
function RespondComposer({ claim }: { claim: ClaimDetail }) {
  const toast = useToast();
  const respond = useRespondToInfoRequest(claim.id);
  const [file, setFile] = useState<File | null>(null);
  const filePreviewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    };
  }, [filePreviewUrl]);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RespondInfoFormValues>({ resolver: zodResolver(respondInfoSchema), defaultValues: { message: '' } });

  const onSubmit = async (values: RespondInfoFormValues) => {
    try {
      await respond.mutateAsync({ message: values.message, receiptFile: file });
      toast.success('Response sent', 'Your claim has been sent back for a decision.');
      reset();
      setFile(null);
    } catch (err) {
      toast.error('Could not send response', err instanceof Error ? err.message : undefined);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex shrink-0 flex-col gap-2 border-t border-slate-100 p-3 sm:p-4" noValidate>
      <Textarea rows={2} placeholder="Provide the requested information…" error={errors.message?.message} {...register('message')} />
      {file && filePreviewUrl ? (
        <div className="max-w-xs">
          <ReceiptPreview
            receipt={{ id: 'pending', claimId: claim.id, claimItemId: null, fileName: file.name, mimeType: file.type, fileSize: file.size, uploadedById: '', createdAt: '', url: filePreviewUrl }}
            onRemove={() => setFile(null)}
          />
        </div>
      ) : (
        <ReceiptUploadButton label="Attach an additional receipt (optional)" onFile={setFile} />
      )}
      {respond.isError ? <ErrorState error={respond.error} /> : null}
      <div className="flex justify-end">
        <Button type="submit" size="sm" isLoading={respond.isPending}>
          Send Response
        </Button>
      </div>
    </form>
  );
}

/** Reply box for the decision-maker (assigned approver or Finance), shown only while a decision is pending. */
function RequestInfoComposer({ claim }: { claim: ClaimDetail }) {
  const toast = useToast();
  const requestInfo = useRequestInfo(claim.id);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InfoRequestFormValues>({ resolver: zodResolver(infoRequestSchema), defaultValues: { message: '' } });

  const onSubmit = async (values: InfoRequestFormValues) => {
    try {
      await requestInfo.mutateAsync(values.message);
      toast.success('Information requested', 'The claimant has been notified.');
      reset();
    } catch (err) {
      toast.error('Could not send request', err instanceof Error ? err.message : undefined);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex shrink-0 flex-col gap-2 border-t border-slate-100 p-3 sm:p-4" noValidate>
      <Textarea rows={2} placeholder="Ask the claimant for additional information or documents…" error={errors.message?.message} {...register('message')} />
      {requestInfo.isError ? <ErrorState error={requestInfo.error} /> : null}
      <div className="flex justify-end">
        <Button type="submit" size="sm" isLoading={requestInfo.isPending}>
          Send Request
        </Button>
      </div>
    </form>
  );
}

/**
 * What the signed-in user can currently do in this claim's message thread —
 * drives which composer shows here, and the entry-point button's label and
 * emphasis in `ClaimDetailView` (so it can say something concrete like "Ask
 * for More Info" instead of a generic "Show Messages").
 */
export type MessagingCapability = 'respond' | 'requestInfo' | 'view';

export function getMessagingCapability(claim: ClaimDetail, user: User | null): MessagingCapability {
  if (!user || !isInReview(claim.status)) return 'view';
  if (claim.claimantId === user.id) return 'respond';
  if (user.role === Role.FINANCE || claim.assignedApproverId === user.id) return 'requestInfo';
  return 'view';
}

/**
 * Explains, when neither composer applies, why sending is unavailable right
 * now — the panel always shows a footer rather than silently omitting the
 * composer, so it doesn't read as broken.
 */
function readOnlyReason(claim: ClaimDetail, user: User | null): string {
  if (!user) return 'Sign in to send a message.';
  if (!isInReview(claim.status)) return 'This claim is closed — no further messages can be sent.';
  if (user.role === Role.CLAIMANT) return 'You can only send messages on your own claims.';
  return 'This claim is not assigned to you.';
}

/**
 * Chat-style side panel: the message thread plus, while the claim is still
 * in review, an inline composer for whoever is signed in to send the next
 * message — request-info for a decision-maker, or a message for the
 * claimant. Either side can send as many messages as they like — the
 * underlying status just records who most recently asked for info, it
 * doesn't lock out further messages. Shows an explanatory footer instead of
 * the composer once the claim is closed or for a bystander.
 */
export function ClaimMessagesPanel({ claim, onClose }: { claim: ClaimDetail; onClose: () => void }) {
  const { user } = useAuth();
  const capability = getMessagingCapability(claim, user);
  const canRespond = capability === 'respond';
  const canRequestInfo = capability === 'requestInfo';

  return (
    <Card className="flex h-128 flex-col lg:sticky lg:top-4 lg:h-[calc(100vh-6rem)]">
      <CardHeader
        title="Messages"
        subtitle="Info requests and the claimant's responses for this claim."
        action={
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Hide messages"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        }
      />
      <div className="min-h-0 flex-1">
        <MessageThread messages={claim.messages} />
      </div>
      {canRespond && <RespondComposer claim={claim} />}
      {!canRespond && canRequestInfo && <RequestInfoComposer claim={claim} />}
      {!canRespond && !canRequestInfo && (
        <p className="shrink-0 border-t border-slate-100 px-3 py-3 text-center text-xs text-slate-400 sm:px-4">{readOnlyReason(claim, user)}</p>
      )}
    </Card>
  );
}
