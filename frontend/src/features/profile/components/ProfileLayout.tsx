import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Page title block — Figma: title 27 bold at y 42, subtitle 13 muted 5 px below. */
export function ProfileHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header>
      <h1 className="text-[27px] font-bold leading-[33px] text-forest-900">{title}</h1>
      <p className="mt-[5px] pl-0.5 text-[13px] leading-4 text-muted">{subtitle}</p>
    </header>
  );
}

/** Mint panel (radius 16, 20 px padding). `height` is the frame's fixed card height. */
export function ProfileCard({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <section className={cn('relative rounded-panel bg-mint px-5 pt-5', className)} {...rest}>
      {children}
    </section>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-[16px] font-semibold leading-[19px] text-forest-900">{children}</h2>;
}

/** Row of cards under the header (34 px gap): side by side on lg, stacked below. */
export function ProfileRow({ children }: { children: ReactNode }) {
  return <div className="mt-8 flex flex-col items-stretch gap-5 lg:mt-[34px] lg:flex-row lg:items-start">{children}</div>;
}

/** Shared sizes of the two action buttons: 180×40, radius 10, 13 medium. */
export const ACTION_BUTTON = 'h-10 w-full rounded-[10px] text-[13px] font-medium sm:w-[180px]';

export function ProfileLoading() {
  return (
    <div className="mt-8 flex flex-col gap-5 lg:mt-[34px] lg:flex-row" aria-busy="true">
      <div className="h-[420px] w-full animate-pulse rounded-panel bg-line/60 lg:h-[640px] lg:w-[540px]" />
      <div className="h-[420px] w-full animate-pulse rounded-panel bg-line/60 lg:h-[640px] lg:w-[540px]" />
    </div>
  );
}
