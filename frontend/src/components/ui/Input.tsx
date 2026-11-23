import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

/** Text input as drawn in the login frame: 44 px, radius 8, canvas fill, 1 px line border, 14 px text. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { hasError = false, className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={hasError || undefined}
      className={cn(
        'h-11 w-full rounded-[8px] border bg-canvas px-4 text-[14px] text-forest-900 placeholder:text-muted',
        hasError ? 'border-pill-danger-fg' : 'border-line',
        className,
      )}
      {...rest}
    />
  );
});
