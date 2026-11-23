import type { ReactNode } from 'react';

export function EmptyState({ title, message, action }: { title: string; message?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-panel border border-line bg-mint px-6 py-12 text-center">
      <p className="text-[16px] font-semibold text-forest-900">{title}</p>
      {message && <p className="max-w-[420px] text-[13px] text-muted">{message}</p>}
      {action}
    </div>
  );
}
