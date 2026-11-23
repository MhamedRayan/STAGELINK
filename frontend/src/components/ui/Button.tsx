import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'link';
  /** md/sm = in-page buttons (32–36 px); lg = full-width form button (48 px, login). */
  size?: 'md' | 'sm' | 'lg';
  isLoading?: boolean;
}

const VARIANT: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-surface-600 text-inverse hover:bg-surface-700 font-semibold',
  secondary: 'border border-surface-600 bg-mint text-surface-600 hover:bg-line/60 font-medium',
  destructive: 'bg-pill-danger-fg text-inverse hover:opacity-90 font-semibold',
  link: 'bg-transparent text-surface-600 hover:underline font-medium px-0',
};

const SIZE: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-8 rounded-btn px-3 text-[12px]',
  md: 'h-9 rounded-btn px-4 text-[12px]',
  lg: 'h-12 rounded-xl px-4 text-[15px]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', isLoading = false, disabled, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || isLoading}
      className={cn(
        'inline-flex items-center justify-center gap-2 transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        VARIANT[variant],
        variant !== 'link' && SIZE[size],
        className,
      )}
      {...rest}
    >
      {isLoading && <Spinner className="h-4 w-4 border-inverse/40 border-t-inverse" />}
      {children}
    </button>
  );
});
