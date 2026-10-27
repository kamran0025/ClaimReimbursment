import type { InputHTMLAttributes } from 'react';
import clsx from 'clsx';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  indeterminate?: boolean;
}

/** Round selection checkbox (table row / select-all). Supports the indeterminate "some selected" state. */
export function Checkbox({ indeterminate = false, className, ...props }: CheckboxProps) {
  return (
    <input
      type="checkbox"
      ref={(el) => {
        if (el) el.indeterminate = indeterminate;
      }}
      className={clsx(
        'peer h-4.5 w-4.5 shrink-0 cursor-pointer appearance-none rounded-full border border-slate-300 bg-white transition-colors',
        'hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300',
        'checked:border-blue-600 checked:bg-blue-600 indeterminate:border-blue-600 indeterminate:bg-blue-600',
        "checked:bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='white'%3E%3Cpath d='M12.2 5.3a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-2-2a.75.75 0 1 1 1.06-1.06l1.47 1.47 3.97-3.97a.75.75 0 0 1 1.06 0Z'/%3E%3C/svg%3E\")]",
        "indeterminate:bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='white'%3E%3Crect x='4' y='7.25' width='8' height='1.5' rx='.75'/%3E%3C/svg%3E\")]",
        'bg-center bg-no-repeat disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
      {...props}
    />
  );
}
