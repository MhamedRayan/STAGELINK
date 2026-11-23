import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { hasError = false, className, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      aria-invalid={hasError || undefined}
      className={cn(
        'w-full resize-none rounded-btn border bg-canvas px-3.5 py-3 text-[13px] text-forest-900 placeholder:text-muted',
        hasError ? 'border-pill-danger-fg' : 'border-line',
        className,
      )}
      {...rest}
    />
  );
});
