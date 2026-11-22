import { cn } from '@/lib/cn';
import { getStatusInfo, type StatusDomain, type Tone } from '@/lib/status';

const TONE: Record<Tone, string> = {
  neutral: 'bg-pill-neutral-bg text-pill-neutral-fg',
  info: 'bg-pill-info-bg text-pill-info-fg',
  success: 'bg-pill-success-bg text-pill-success-fg',
  warning: 'bg-pill-warning-bg text-pill-warning-fg',
  danger: 'bg-pill-danger-bg text-pill-danger-fg',
};

interface StatusPillProps {
  domain: StatusDomain;
  value: string;
  className?: string;
}

/** Status pill: 26 px high, fully rounded, 12 medium. Label and tone come from lib/status.ts. */
export function StatusPill({ domain, value, className }: StatusPillProps) {
  const { label, tone } = getStatusInfo(domain, value);
  return (
    <span
      className={cn(
        'inline-flex h-[26px] items-center justify-center whitespace-nowrap rounded-pill px-3.5 text-pill',
        TONE[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}
