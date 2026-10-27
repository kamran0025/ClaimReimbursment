import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

/** Sits above a table with row selection: count, "Clear", and the bulk actions for the selection. */
export function SelectionBar({ count, onClear, children }: { count: number; onClear: () => void; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 bg-blue-50 px-4 py-2.5">
      <span className="text-sm font-medium text-blue-800">{count} selected</span>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={onClear}>
          Clear
        </Button>
        {children}
      </div>
    </div>
  );
}
