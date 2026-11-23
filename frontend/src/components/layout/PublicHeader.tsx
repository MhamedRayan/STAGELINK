import { Link, NavLink } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { Logo } from '@/components/ui/Logo';
import { cn } from '@/lib/cn';

/**
 * Guest header — Figma 24:18 / 24:87: 72 px bar on forest-900, logo + wordmark left.
 * `minimal` = brand only (the offer-details frame has no nav).
 */
export function PublicHeader({ minimal = false }: { minimal?: boolean }) {
  return (
    <header className="flex h-[72px] items-center bg-forest-900 pl-[23px] pr-10">
      <Link to={ROUTES.guest.offers} className="flex items-center gap-3">
        <Logo size="md" />
        <span className="text-[18px] font-bold text-inverse">STAGLINK</span>
      </Link>
      {!minimal && (
        <nav className="ml-auto flex items-center gap-[37px]">
          <NavLink
            to={ROUTES.guest.offers}
            className={({ isActive }) =>
              cn('text-[14px]', isActive ? 'font-semibold text-inverse' : 'font-medium text-nav-text')
            }
          >
            Browse Offers
          </NavLink>
          <span className="text-[14px] font-semibold text-inverse">Companies</span>
          <Link
            to={ROUTES.login}
            className="flex h-9 w-[130px] items-center justify-center rounded-[10px] bg-sage text-[13px] font-medium text-forest-900 hover:opacity-90"
          >
            Log in
          </Link>
        </nav>
      )}
    </header>
  );
}
