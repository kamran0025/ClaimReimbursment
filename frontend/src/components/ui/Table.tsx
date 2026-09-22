import type { ReactNode } from 'react';
import clsx from 'clsx';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
}

/** Simple, dense data table. Wraps in its own horizontal scroller on narrow screens. */
export function Table<T>({ columns, rows, rowKey, onRowClick }: TableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {columns.map((col) => (
              <th
                key={col.key}
                className={clsx('px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500', col.headerClassName)}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={clsx(onRowClick && 'cursor-pointer hover:bg-slate-50')}
            >
              {columns.map((col) => (
                <td key={col.key} className={clsx('px-4 py-3 align-middle text-slate-700', col.className)}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
