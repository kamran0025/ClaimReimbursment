import type { Receipt } from '@/types/models';
import { Button } from '@/components/ui/Button';
import { formatFileSize } from '@/utils/format';

function isImage(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/** A single receipt's thumbnail (images) or file icon (PDF), with filename/size and an optional remove action. */
export function ReceiptPreview({ receipt, onRemove, removeLabel = 'Remove' }: { receipt: Receipt; onRemove?: () => void; removeLabel?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5">
      <a href={receipt.url} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-center gap-2">
        {isImage(receipt.mimeType) ? (
          <img src={receipt.url} alt={receipt.fileName} className="h-9 w-9 shrink-0 rounded object-cover ring-1 ring-slate-200" />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-red-50 text-red-500 ring-1 ring-red-100">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path
                fillRule="evenodd"
                d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium text-slate-700">{receipt.fileName}</span>
          <span className="block text-[11px] text-slate-400">{formatFileSize(receipt.fileSize)}</span>
        </span>
      </a>
      {onRemove && (
        <Button type="button" variant="ghost" size="sm" className="shrink-0 text-red-600 hover:bg-red-50" onClick={onRemove}>
          {removeLabel}
        </Button>
      )}
    </div>
  );
}
