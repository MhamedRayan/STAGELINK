import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (item: T) => React.ReactNode;
  className?: string;
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  emptyMessage?: string;
  isLoading?: boolean;
  onRowClick?: (item: T) => void;
  className?: string;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = 'No items found',
  isLoading = false,
  onRowClick,
  className,
}: TableProps<T>) {
  if (isLoading) {
    return (
      <div className="py-12 flex justify-center items-center">
        <div className="w-6 h-6 border-2 border-surface-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="py-12 text-center text-[13px] text-mutedText">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={twMerge('overflow-x-auto w-full', className)}>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-mint-300/80 bg-mint-50/50">
            {columns.map((col, idx) => (
              <th
                key={idx}
                className={clsx(
                  'py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-mutedText',
                  col.className
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-mint-200/50">
          {data.map((item) => (
            <tr
              key={keyExtractor(item)}
              onClick={() => onRowClick && onRowClick(item)}
              className={clsx(
                'text-[13px] text-forest-900 transition-colors',
                onRowClick ? 'cursor-pointer hover:bg-mint-100/50' : 'hover:bg-mint-50/30'
              )}
            >
              {columns.map((col, idx) => (
                <td key={idx} className={clsx('py-3.5 px-4', col.className)}>
                  {col.cell
                    ? col.cell(item)
                    : col.accessorKey
                    ? String(item[col.accessorKey] ?? '')
                    : null}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
