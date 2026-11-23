import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface SectionCardProps {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  variant?: 'white' | 'mint';
  className?: string;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  title,
  subtitle,
  action,
  children,
  variant = 'white',
  className,
}) => {
  const bg = variant === 'mint' ? 'bg-mint' : 'bg-white';

  return (
    <div
      className={twMerge(
        clsx(
          bg,
          'rounded-xl p-6 border border-mint-300/50 shadow-xs',
          className
        )
      )}
    >
      {(title || action) && (
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-mint-200/60">
          <div>
            {title && (
              <h2 className="text-lg font-semibold text-forest-900 tracking-tight">
                {title}
              </h2>
            )}
            {subtitle && <p className="text-xs text-mutedText mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
};
