import { Search } from 'lucide-react';
import { NotificationBell } from '@/components/ui/NotificationBell';

interface TopBarProps {
  /** Optional — page titles are usually rendered by PageHeader inside the page. */
  title?: string;
  subtitle?: string;
  value?: string;
  onChange?(value: string): void;
}

/** Search + bell only. Kept separate from the sidebar so page headings stay with their pages. */
export function TopBar({ title, subtitle, value = '', onChange }: TopBarProps) {
  return (
    <header className="flex h-16 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-line bg-canvas px-4 sm:px-6 lg:px-[42px]">
      <div className="min-w-0 flex-1">
        {title && <h2 className="truncate text-[16px] font-semibold text-forest-900">{title}</h2>}
        {subtitle && <p className="truncate text-[12px] text-muted">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        <div className="relative w-full max-w-[280px] sm:w-[280px]">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            aria-label="Search this page"
            value={value}
            onChange={(event) => onChange?.(event.target.value)}
            placeholder="Search…"
            className="h-9 w-full rounded-pill border border-line bg-mint pl-9 pr-3 text-[12px] text-forest-900 placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface-600"
          />
        </div>
        <NotificationBell />
      </div>
    </header>
  );
}
