import { forwardRef, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  hasError?: boolean;
}

/** Native select styled like Input (44 px, radius 8, canvas fill, 1 px line border). */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { hasError = false, className, children, ...rest },
  ref,
) {
  return (
    <span className="relative block">
      <select
        ref={ref}
        aria-invalid={hasError || undefined}
        className={cn(
          'h-11 w-full appearance-none rounded-[8px] border bg-canvas px-4 pr-10 text-[14px] text-forest-900',
          hasError ? 'border-pill-danger-fg' : 'border-line',
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
      />
    </span>
  );
});
