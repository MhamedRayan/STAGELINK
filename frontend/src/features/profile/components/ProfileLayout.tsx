import type { HTMLAttributes, ReactNode } from 'react';
import { Avatar, Skeleton } from '@/components/ui';
import { cn } from '@/lib/cn';
import { ProfileLogoutButton } from './ProfileLogoutButton';

/** Page title block — title 27 bold at y 42, subtitle 13 muted 5 px below. */
export function ProfileHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header>
      <h1 className="text-[27px] font-bold leading-[33px] text-forest-900">{title}</h1>
      <p className="mt-[5px] pl-0.5 text-[13px] leading-4 text-muted">{subtitle}</p>
    </header>
  );
}

/** Joins the non-empty fragments of an identity line with a middle dot. */
export function profileMeta(...parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' · ');
}

/**
 * One soft panel per profile page: identity strip, hairline-separated sections, action bar.
 * Replaces the frame's two fixed cards so the page reads as a single, calm surface.
 */
export function ProfilePanel({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <section className={cn('rounded-panel bg-mint px-5 py-6 sm:px-7 sm:py-7', className)} {...rest}>
      {children}
    </section>
  );
}

/** Avatar, display name and a one-line meta, with an optional status badge on the right. */
export function ProfileIdentity({
  name,
  meta,
  badge,
}: {
  name: string;
  meta: string;
  badge?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <Avatar name={name} className="h-14 w-14 text-[16px]" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[19px] font-semibold leading-6 text-forest-900">{name}</p>
        <p className="mt-1 truncate text-[12px] leading-[17px] text-muted">{meta}</p>
      </div>
      {badge && <div className="w-full pl-[72px] lg:w-auto lg:pl-0">{badge}</div>}
    </div>
  );
}

/** Titled block inside the panel: a sage tick, the title, optional helper copy, then the fields. */
export function ProfileSection({
  title,
  description,
  className,
  children,
}: {
  title: string;
  description?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section className={cn('mt-6 border-t border-line pt-6', className)}>
      <div className="flex items-center gap-2.5">
        <span aria-hidden="true" className="h-4 w-[3px] rounded-full bg-sage" />
        <h2 className="text-[14px] font-semibold leading-5 text-forest-900">{title}</h2>
      </div>
      {description && (
        <p className="mt-2 max-w-[620px] text-[12px] leading-[18px] text-muted">{description}</p>
      )}
      {children && <div className="mt-4">{children}</div>}
    </section>
  );
}

/** Field grid: one column on phones, two from `sm`, three from `xl` when asked. */
export function FieldGrid({
  columns = 2,
  className,
  children,
}: {
  columns?: 2 | 3;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2',
        columns === 3 && 'xl:grid-cols-3',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Bottom bar, separated by a hairline: save and change password on the left, log out right. */
export function ProfileActions({ children }: { children: ReactNode }) {
  return (
    <div className="mt-7 border-t border-line pt-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {children}
        <ProfileLogoutButton />
      </div>
    </div>
  );
}

/** Shared size of the two main action buttons: 180×40, radius 10, 13 medium. */
export const ACTION_BUTTON = 'h-10 w-full rounded-[10px] text-[13px] font-medium sm:w-[180px]';

/** First-load skeleton shaped like the single panel. */
export function ProfileLoading() {
  return (
    <div className="mt-8 rounded-panel bg-mint px-5 py-6 sm:px-7 sm:py-7" aria-busy="true">
      <div className="flex items-center gap-4">
        <Skeleton className="h-14 w-14 rounded-full" />
        <div className="min-w-0 flex-1">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="mt-2 h-3 w-32" />
        </div>
      </div>
      {[0, 1].map((row) => (
        <div key={row} className="mt-6 border-t border-line pt-6">
          <Skeleton className="h-3 w-32" />
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      ))}
      <div className="mt-7 border-t border-line pt-6">
        <Skeleton className="h-10 w-full sm:w-[180px]" />
      </div>
    </div>
  );
}
