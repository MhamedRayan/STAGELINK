import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { Skeleton } from './Skeleton';

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  isLoading?: boolean;
  /** When set, the whole card links to this route and gains the interactive highlight. */
  to?: string;
}

/** Dashboard stat card as drawn in 24:112: mint surface, 110 px tall, label / value / hint. */
export function StatCard({ label, value, hint, isLoading = false, to }: StatCardProps) {
  const body = (
    <>
      <p className={cn('text-[12px] font-medium leading-4 text-muted', to && 'pr-6')}>{label}</p>
      {isLoading ? (
        <Skeleton className="mt-[10px] h-[26px] w-16" />
      ) : (
        <p className="mt-[10px] text-[26px] font-bold leading-[32px] text-forest-900">{value}</p>
      )}
      {hint &&
        (isLoading ? (
          <Skeleton className="mt-auto h-3 w-24" />
        ) : (
          <p className="mt-auto text-[10px] leading-[14px] text-muted">{hint}</p>
        ))}
    </>
  );

  const className =
    'relative flex h-[110px] flex-col rounded-[14px] bg-mint px-[18px] pb-[14px] pt-[18px] text-left';

  if (!to) return <div className={className}>{body}</div>;

  return (
    <Link to={to} className={cn(className, 'clickable group')}>
      <ArrowUpRight
        aria-hidden="true"
        className="absolute right-[14px] top-[14px] h-4 w-4 text-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      />
      {body}
    </Link>
  );
}
