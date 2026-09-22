import type { ReactNode } from 'react';
import clsx from 'clsx';

export type BadgeColor = 'slate' | 'gray' | 'blue' | 'amber' | 'orange' | 'red' | 'green' | 'purple' | 'teal';

const colorClasses: Record<BadgeColor, string> = {
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  gray: 'bg-gray-200 text-gray-700 ring-gray-300',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  orange: 'bg-orange-50 text-orange-700 ring-orange-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  purple: 'bg-purple-50 text-purple-700 ring-purple-200',
  teal: 'bg-teal-50 text-teal-700 ring-teal-200',
};

export function Badge({ color = 'slate', children, className }: { color?: BadgeColor; children: ReactNode; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        colorClasses[color],
        className,
      )}
    >
      {children}
    </span>
  );
}
