import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import type { Tone } from '@/lib/status';

const TONE: Record<Tone, string> = {
  neutral: 'bg-pill-neutral-bg text-pill-neutral-fg',
  info: 'bg-pill-info-bg text-pill-info-fg',
  success: 'bg-pill-success-bg text-pill-success-fg',
  warning: 'bg-pill-warning-bg text-pill-warning-fg',
  danger: 'bg-pill-danger-bg text-pill-danger-fg',
};

/** Static label pill (not tied to a status vocabulary), e.g. the "Internship" tag on offer cards. */
export function Pill({ tone = 'neutral', className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex h-[26px] items-center justify-center whitespace-nowrap rounded-pill px-3.5 text-pill',
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
