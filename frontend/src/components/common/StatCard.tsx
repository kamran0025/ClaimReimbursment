import type { ReactNode } from 'react';
import clsx from 'clsx';
import { Card } from '@/components/ui/Card';

export function StatCard({
  label,
  value,
  hint,
  accent = 'slate',
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: 'slate' | 'blue' | 'amber' | 'orange' | 'green' | 'red' | 'purple' | 'teal';
}) {
  const accentClasses: Record<string, string> = {
    slate: 'text-slate-900',
    blue: 'text-blue-700',
    amber: 'text-amber-700',
    orange: 'text-orange-700',
    green: 'text-emerald-700',
    red: 'text-red-700',
    purple: 'text-purple-700',
    teal: 'text-teal-700',
  };
  return (
    <Card className="min-w-0 p-4">
      <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={clsx('mt-1.5 break-words text-xl font-semibold sm:text-2xl', accentClasses[accent])}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </Card>
  );
}
