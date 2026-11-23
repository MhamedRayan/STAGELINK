import React from 'react';
import { Inbox } from 'lucide-react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = <Inbox className="w-10 h-10 text-mutedText/60" />,
  title,
  description,
  action,
}) => {
  return (
    <div className="py-12 flex flex-col items-center justify-center text-center px-4">
      <div className="mb-3">{icon}</div>
      <h3 className="text-sm font-semibold text-forest-900 mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-mutedText max-w-sm mb-4">{description}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
};
