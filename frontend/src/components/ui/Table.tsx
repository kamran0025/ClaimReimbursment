import type { ReactNode } from 'react';
import clsx from 'clsx';
import { Checkbox } from './Checkbox';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
}

/**
 * Opt-in row selection: a checkbox column plus a header "select all" for the
 * rows on screen. Keys outside `rows` (e.g. picked on another page) are kept.
 */
export interface TableSelection<T> {
  selectedKeys: ReadonlySet<string>;
  onChange: (keys: Set<string>) => void;
  /** Rows failing this get a disabled checkbox. Defaults to all selectable. */
  isRowSelectable?: (row: T) => boolean;
}

interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  selection?: TableSelection<T>;
}

/** Simple, dense data table. Wraps in its own horizontal scroller on narrow screens. */
export function Table<T>({ columns, rows, rowKey, onRowClick, selection }: TableProps<T>) {
  const selectableKeys = selection ? rows.filter((r) => selection.isRowSelectable?.(r) ?? true).map(rowKey) : [];
  const selectedOnPage = selection ? selectableKeys.filter((k) => selection.selectedKeys.has(k)).length : 0;
  const allSelected = selectableKeys.length > 0 && selectedOnPage === selectableKeys.length;

  const toggleAll = () => {
    if (!selection) return;
    const next = new Set(selection.selectedKeys);
    for (const k of selectableKeys) {
      if (allSelected) next.delete(k);
      else next.add(k);
    }
    selection.onChange(next);
  };
  const toggleRow = (key: string) => {
    if (!selection) return;
    const next = new Set(selection.selectedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    selection.onChange(next);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {selection && (
              <th className="w-10 px-4 py-2.5">
                <Checkbox
                  aria-label="Select all rows"
                  checked={allSelected}
                  indeterminate={selectedOnPage > 0 && !allSelected}
                  disabled={selectableKeys.length === 0}
                  onChange={toggleAll}
                />
              </th>
            )}
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
          {rows.map((row) => {
            const key = rowKey(row);
            const isSelected = !!selection?.selectedKeys.has(key);
            return (
            <tr
              key={key}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={clsx(onRowClick && 'cursor-pointer hover:bg-slate-50', isSelected && 'bg-blue-50/60')}
            >
              {selection && (
                // Clicking the checkbox cell must not also trigger the row's navigation.
                <td className="w-10 px-4 py-3 align-middle" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    aria-label="Select row"
                    checked={isSelected}
                    disabled={!(selection.isRowSelectable?.(row) ?? true)}
                    onChange={() => toggleRow(key)}
                  />
                </td>
              )}
              {columns.map((col) => (
                <td key={col.key} className={clsx('px-4 py-3 align-middle text-slate-700', col.className)}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
