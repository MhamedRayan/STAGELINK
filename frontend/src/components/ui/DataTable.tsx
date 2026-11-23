import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { EmptyState } from './EmptyState';
import { Skeleton } from './Skeleton';

export interface Column<T> {
  key: string;
  header: string;
  render(row: T): ReactNode;
  align?: 'left' | 'right';
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowKey(row: T): string;
  isLoading?: boolean;
  emptyState?: ReactNode;
  onRowClick?(row: T): void;
  /** Optional extensions to the frozen API, used by the platform pages. */
  className?: string;
  rowClassName?: string;
}

/** Shared table: mint panel, 11 px uppercase head, 14 px forest body, 1 px line separators. */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  isLoading = false,
  emptyState,
  onRowClick,
  className,
  rowClassName,
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div
        role="status"
        aria-label="Loading table"
        className={cn('rounded-panel border border-line bg-mint px-5 py-2', className)}
      >
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="flex gap-5 border-b border-line/70 py-[18px] last:border-0">
            {columns.map((column) => (
              <Skeleton key={column.key} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return emptyState ?? <EmptyState title="Nothing to show" />;
  }

  return (
    <div className={cn('w-full overflow-x-auto rounded-panel border border-line bg-mint', className)}>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-line">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                style={column.width ? { width: column.width } : undefined}
                className={cn(
                  'whitespace-nowrap px-5 py-3 text-table-head font-medium uppercase text-muted',
                  column.align === 'right' && 'text-right',
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line/70">
          {rows.map((row) => (
            <tr
              key={getRowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                'text-table-body text-forest-900',
                onRowClick && 'cursor-pointer hover:bg-line/30',
                rowClassName,
              )}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn('px-5 align-middle', column.align === 'right' && 'text-right')}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
