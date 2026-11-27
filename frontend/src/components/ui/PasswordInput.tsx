import { Eye, EyeOff } from 'lucide-react';
import { forwardRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { Input, type InputProps } from './Input';

export interface PasswordInputProps extends Omit<InputProps, 'type'> {
  /** Accessible label for the eye button while the password is hidden. */
  showLabel: string;
  /** Accessible label for the eye button while the password is visible. */
  hideLabel: string;
}

/** Password input with an eye toggle. Keeps the input node (and React Hook Form ref) intact. */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { showLabel, hideLabel, className, ...rest },
  ref,
) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        {...rest}
        ref={ref}
        type={isVisible ? 'text' : 'password'}
        className={cn('pr-11', className)}
      />
      <button
        type="button"
        aria-label={isVisible ? hideLabel : showLabel}
        aria-pressed={isVisible}
        onClick={() => setIsVisible((visible) => !visible)}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-[8px] text-muted transition-colors hover:text-forest-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-surface-600"
      >
        {isVisible ? (
          <EyeOff aria-hidden="true" className="h-4 w-4" />
        ) : (
          <Eye aria-hidden="true" className="h-4 w-4" />
        )}
      </button>
    </div>
  );
});
