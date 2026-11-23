import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

interface StepperProps {
  steps: string[];
  activeIndex: number;
}

/** Confirmed → In progress → Completed, with completed steps checked. */
export function Stepper({ steps, activeIndex }: StepperProps) {
  return (
    <ol className="flex w-full items-start">
      {steps.map((step, index) => {
        const isDone = index < activeIndex;
        const isActive = index === activeIndex;
        const isLast = index === steps.length - 1;
        return (
          <li key={step} className={cn('flex items-start', !isLast && 'flex-1')}>
            <div className="flex w-[92px] shrink-0 flex-col items-center gap-2 text-center">
              <span
                aria-hidden="true"
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border text-[12px] font-semibold',
                  isDone && 'border-surface-600 bg-surface-600 text-inverse',
                  isActive && 'border-surface-600 bg-mint text-surface-600',
                  !isDone && !isActive && 'border-line bg-mint text-muted',
                )}
              >
                {isDone ? <Check className="h-4 w-4" /> : index + 1}
              </span>
              <span
                className={cn(
                  'text-[12px]',
                  isActive || isDone ? 'font-semibold text-forest-900' : 'text-muted',
                )}
              >
                {step}
              </span>
            </div>
            {!isLast && (
              <span
                aria-hidden="true"
                className={cn('mt-4 h-px flex-1', isDone ? 'bg-surface-600' : 'bg-line')}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
