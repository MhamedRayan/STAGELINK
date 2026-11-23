import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: 'white' | 'mint';
}

/** Section card: 12 px radius, 24 px padding. */
export function Card({ tone = 'white', className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-card border border-line p-6',
        tone === 'mint' ? 'bg-mint' : 'bg-white',
        className,
      )}
      {...rest}
    />
  );
}
