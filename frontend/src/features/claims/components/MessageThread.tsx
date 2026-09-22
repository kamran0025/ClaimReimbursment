import type { ClaimMessage } from '@/types/models';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { ReceiptPreview } from './ReceiptPreview';
import { formatDateTime } from '@/utils/format';
import { useAuth } from '@/app/AuthContext';
import clsx from 'clsx';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

/** Chronological info-request / response thread, styled as a chat conversation between the claimant and decision-maker. */
export function MessageThread({ messages }: { messages: ClaimMessage[] }) {
  const { user } = useAuth();

  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg bg-slate-50">
        <EmptyState title="No messages yet" description="Info requests from a decision-maker and the claimant's responses will appear here." />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto rounded-lg bg-slate-50 p-3 sm:p-4">
      <ol className="flex flex-col gap-4">
        {messages.map((m) => {
          const isRequest = m.type === 'INFO_REQUEST';
          const isMine = m.senderId === user?.id;
          const name = m.sender?.name ?? m.senderId;

          return (
            <li key={m.id} className={clsx('flex items-end gap-2', isMine && 'flex-row-reverse')}>
              <div
                className={clsx(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-2 ring-white',
                  isMine ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-700',
                )}
                title={name}
              >
                {initials(name)}
              </div>

              <div className={clsx('flex max-w-[80%] flex-col gap-1 sm:max-w-[70%]', isMine ? 'items-end' : 'items-start')}>
                <div className={clsx('flex items-center gap-1.5 px-1', isMine && 'flex-row-reverse')}>
                  <span className="text-xs font-medium text-slate-600">{isMine ? 'You' : name}</span>
                  <Badge color={isRequest ? 'orange' : 'blue'}>{isRequest ? 'Info requested' : 'Response'}</Badge>
                </div>

                <div
                  className={clsx(
                    'rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm',
                    isMine ? 'rounded-br-sm bg-blue-600 text-white' : 'rounded-bl-sm bg-white text-slate-800 ring-1 ring-slate-200',
                  )}
                >
                  <p className="whitespace-pre-wrap">{m.message}</p>
                  {m.attachedReceipt && (
                    <div className="mt-2">
                      <ReceiptPreview receipt={m.attachedReceipt} />
                    </div>
                  )}
                </div>

                <span className="px-1 text-[11px] text-slate-400">{formatDateTime(m.createdAt)}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
