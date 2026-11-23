import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  /** Space between label and control: sm = 6 px (login), md = 8 px (register form). */
  controlGap?: 'sm' | 'md';
  className?: string;
  children: ReactNode;
}

/** Label (13 medium) above a control. The control sits inside the <label>, so no ids are needed. */
export function Field({ label, error, hint, controlGap = 'sm', className, children }: FieldProps) {
  return (
    <label className={cn('block', className)}>
      <span className="block text-[13px] font-medium leading-4 text-forest-900">{label}</span>
      <span className={cn('block', controlGap === 'md' ? 'mt-2' : 'mt-1.5')}>{children}</span>
      {hint && !error && <span className="mt-1 block text-[12px] text-muted">{hint}</span>}
      {error && (
        <span role="alert" className="mt-1 block text-[12px] leading-[15px] text-pill-danger-fg">
          {error}
        </span>
      )}
    </label>
  );
}
