import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Right-aligned control (filter, primary action). */
  action?: ReactNode;
}

/** Page title (28 bold, forest-900) with a 13 muted subtitle; optional right-aligned action. */
export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-page-title text-forest-900">{title}</h1>
        {subtitle && <p className="mt-1 text-body text-muted">{subtitle}</p>}
      </div>
      {action && <div className="min-w-0 max-w-full">{action}</div>}
    </div>
  );
}
