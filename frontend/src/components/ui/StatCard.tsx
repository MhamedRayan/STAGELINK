import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ReactNode;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  hint,
  icon,
  className,
}) => {
  return (
    <div
      className={twMerge(
        clsx(
          'bg-mint rounded-xl p-5 border border-mint-300/40 shadow-xs flex flex-col justify-between transition-shadow hover:shadow-sm',
          className
        )
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-medium text-mutedText">{label}</span>
        {icon && <div className="text-surface-700 opacity-80">{icon}</div>}
      </div>
      <div className="text-3xl font-bold text-forest-900 tracking-tight">{value}</div>
      {hint && <div className="text-xs text-mutedText mt-1.5 font-normal">{hint}</div>}
    </div>
  );
};
