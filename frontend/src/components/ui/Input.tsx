import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import clsx from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id ?? props.name;
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={clsx(
            'rounded-md border px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            error
              ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
              : 'border-slate-300 focus:border-slate-500 focus:ring-slate-200',
            'disabled:bg-slate-50 disabled:text-slate-400',
            className,
          )}
          aria-invalid={!!error}
          {...props}
        />
        {hint && !error && <span className="text-xs text-slate-500">{hint}</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    );
  },
);
Input.displayName = 'Input';
