import { Skeleton } from './Skeleton';

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  isLoading?: boolean;
}

/** Dashboard stat card as drawn in 24:112: mint surface, 110 px tall, label / value / hint. */
export function StatCard({ label, value, hint, isLoading = false }: StatCardProps) {
  return (
    <div className="flex h-[110px] flex-col rounded-[14px] bg-mint px-[18px] pb-[14px] pt-[18px]">
      <p className="text-[12px] font-medium leading-4 text-muted">{label}</p>
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
    </div>
  );
}
