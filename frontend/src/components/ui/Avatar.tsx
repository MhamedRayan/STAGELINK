import { cn } from '@/lib/cn';

export interface AvatarProps {
  /** Display name used to derive the default initials. */
  name?: string | null;
  className?: string;
}

/** Up to two initials from a display name; stable for the same name. */
export function avatarInitials(name?: string | null): string {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return 'SL';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

/** Default account avatar: initials on the sage token, with no upload or storage. */
export function Avatar({ name, className }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid shrink-0 place-items-center rounded-full bg-sage text-[11px] font-semibold leading-none text-forest-900',
        className,
      )}
    >
      {avatarInitials(name)}
    </span>
  );
}
