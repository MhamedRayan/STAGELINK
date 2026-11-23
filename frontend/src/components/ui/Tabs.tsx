import { cn } from '@/lib/cn';

interface TabsProps {
  tabs: { id: string; label: string }[];
  active: string;
  onChange(id: string): void;
}

/** Pill tabs for filtering a single list (e.g. verification status). */
export function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div role="tablist" className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              'h-8 rounded-pill px-4 text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface-600',
              isActive
                ? 'bg-surface-600 font-semibold text-inverse'
                : 'border border-line bg-mint font-medium text-muted hover:text-forest-900',
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
