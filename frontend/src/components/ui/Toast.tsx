import clsx from 'clsx';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastData {
  id: string;
  kind: ToastKind;
  title: string;
  message?: string;
}

const kindClasses: Record<ToastKind, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-slate-200 bg-white text-slate-800',
};

const kindIcon: Record<ToastKind, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
};

export function Toast({ toast, onDismiss }: { toast: ToastData; onDismiss: (id: string) => void }) {
  return (
    <div
      role="alert"
      className={clsx('flex w-full max-w-sm items-start gap-2.5 rounded-lg border px-4 py-3 shadow-md', kindClasses[toast.kind])}
    >
      <span className="mt-0.5 text-sm font-bold">{kindIcon[toast.kind]}</span>
      <div className="flex-1 text-sm">
        <p className="font-semibold">{toast.title}</p>
        {toast.message && <p className="mt-0.5 text-xs opacity-90">{toast.message}</p>}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss"
        className="text-current opacity-60 hover:opacity-100"
      >
        ✕
      </button>
    </div>
  );
}

export function ToastContainer({ toasts, onDismiss }: { toasts: ToastData[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:right-4 sm:left-auto">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto w-full sm:w-auto">
          <Toast toast={t} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}
