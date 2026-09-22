import type { HTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx('rounded-lg border border-slate-200 bg-white shadow-sm', className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5', className)}>
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx('px-4 py-4 sm:px-5', className)}>{children}</div>;
}
