import { forwardRef } from 'react';
import type { SelectHTMLAttributes } from 'react';
import clsx from 'clsx';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, placeholder, id, children, ...props }, ref) => {
    const inputId = id ?? props.name;
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={inputId}
          className={clsx(
            'rounded-md border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            error
              ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
              : 'border-slate-300 focus:border-slate-500 focus:ring-slate-200',
            'disabled:bg-slate-50 disabled:text-slate-400',
            className,
          )}
          aria-invalid={!!error}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {children}
        </select>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    );
  },
);
Select.displayName = 'Select';
