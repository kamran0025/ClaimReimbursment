import { toErrorBody } from '@/services/api';
import { Button } from '@/components/ui/Button';

/**
 * Renders the backend-style `{ success: false, error: { code, message } }`
 * envelope a real API error response would carry — not a generic client
 * message. This is deliberate: the UI must show what the backend says.
 */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const body = toErrorBody(error);
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-6 py-10 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
          <path
            fillRule="evenodd"
            d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 8a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
      </div>
      <div>
        <p className="text-sm font-semibold text-red-800">{body.error.message}</p>
        <p className="mt-0.5 font-mono text-xs text-red-500">{body.error.code}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
