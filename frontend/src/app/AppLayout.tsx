import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Bell,
  Briefcase,
  Building2,
  CircleCheck,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Inbox,
  LayoutGrid,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  PlusCircle,
  User,
  UserCog,
  UserPlus,
  Users,
  X,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { useAuth } from '@/features/auth/AuthProvider';
import { cn } from '@/lib/cn';
import { ROLE_LABEL, type Role } from '@/lib/roles';
import { NAV_ITEMS } from './nav';

/** One line icon per nav label; unknown labels fall back to the dashboard icon. */
const NAV_ICONS: Record<string, LucideIcon> = {
  Dashboard: LayoutGrid,
  'Company Verification': CircleCheck,
  Universities: Building2,
  'Create Accounts': UserPlus,
  Profile: User,
  'Company Profile': User,
  'Browse Offers': Briefcase,
  'My Offers': Briefcase,
  'Post Internship': PlusCircle,
  'Incoming Requests': Inbox,
  'My Applications': FileText,
  Applications: FileText,
  Cancellations: XCircle,
  'My Internship': GraduationCap,
  Internships: GraduationCap,
  'Final Submission': ClipboardCheck,
  'Final Reviews': ClipboardCheck,
  Notifications: Bell,
  Students: Users,
  'My Students': Users,
  Supervisors: UserCog,
};

/** Tiny per-viewer preference: below `lg` the sidebar is always a drawer, so this only
 *  affects desktop where the sidebar collapses to an icon rail. */
const SIDEBAR_PREF_KEY = 'stagelink.sidebar-collapsed';

function readCollapsedPref(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_PREF_KEY) === '1';
  } catch {
    return false;
  }
}

/** The icon rail is a desktop-only affordance; below `lg` the drawer always shows labels. */
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(
    () =>
      typeof window.matchMedia !== 'function' ||
      window.matchMedia('(min-width: 1024px)').matches,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setIsDesktop(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return isDesktop;
}

/**
 * App shell: 260 px sidebar on desktop that collapses to a 76 px icon rail, and an
 * off-canvas drawer below `lg`. Measurements come from Figma frame 25:524.
 */
export function AppLayout({ role }: { role: Role }) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(readCollapsedPref);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const isDesktop = useIsDesktop();
  const isRail = isCollapsed && isDesktop;
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  // Mobile drawer: close on navigation, Esc, and while it is open lock page scroll.
  useEffect(() => {
    setIsDrawerOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isDrawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsDrawerOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [isDrawerOpen]);

  const setCollapsed = (next: boolean) => {
    setIsCollapsed(next);
    try {
      window.localStorage.setItem(SIDEBAR_PREF_KEY, next ? '1' : '0');
    } catch {
      /* preference is optional */
    }
  };

  const toggleDesktopSidebar = () => setCollapsed(!isCollapsed);

  return (
    <div className="flex min-h-screen bg-canvas">
      {isDrawerOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setIsDrawerOpen(false)}
          className="fixed inset-0 z-30 bg-forest-900/50 lg:hidden"
        />
      )}

      <aside
        id="app-sidebar"
        aria-label="Main navigation"
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex h-screen w-sidebar shrink-0 flex-col overflow-y-auto bg-forest-900 transition-transform duration-200 lg:translate-x-0 lg:transition-[width]',
          isDrawerOpen ? 'translate-x-0' : '-translate-x-full',
          isRail ? 'lg:w-[76px]' : 'lg:w-sidebar',
        )}
      >
        <div className={cn('shrink-0 pt-[23px]', isRail ? 'px-4' : 'px-[25px]')}>
          <div className={cn('flex items-start', isRail ? 'justify-center' : 'gap-[7px]')}>
            <Logo />
            {!isRail && (
              <span className="mt-[5px] text-[18px] font-bold leading-6 text-inverse">STAGLINK</span>
            )}
          </div>
          {!isRail && (
            <p className="mt-2 pl-[3px] text-[13px] font-medium leading-[17px] text-sage">
              University Internship
              <br />
              Management Platform
            </p>
          )}
        </div>

        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setIsDrawerOpen(false)}
          className="absolute right-3 top-4 inline-flex h-8 w-8 items-center justify-center rounded-btn text-nav-text hover:bg-surface-700 hover:text-inverse lg:hidden"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>

        <div className={cn('mt-[15px] h-px shrink-0 bg-line', isRail ? 'mx-3' : 'ml-6 mr-[26px]')} />

        <nav className={cn('mt-[18px] space-y-2.5', isRail ? 'px-3' : 'px-4')}>
          {NAV_ITEMS[role].map((item) => {
            const Icon = NAV_ICONS[item.label] ?? LayoutGrid;
            return (
              <NavLink
                key={item.label}
                to={item.to}
                end={item.end}
                title={isRail ? item.label : undefined}
                aria-label={item.label}
                className={({ isActive }) =>
                  cn(
                    'flex h-[38px] items-center gap-[11px] rounded-[10px] text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage',
                    isRail ? 'justify-center px-0' : 'px-[13px]',
                    isActive
                      ? 'bg-surface-600 font-semibold text-inverse'
                      : 'font-medium text-nav-text hover:bg-surface-700 hover:text-inverse',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      aria-hidden="true"
                      strokeWidth={1.75}
                      className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-inverse' : 'text-nav-text')}
                    />
                    {!isRail && item.label}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div ref={menuRef} className="relative mt-auto shrink-0">
          <div className={cn('h-px bg-line', isRail ? 'mx-3' : 'mx-[22px]')} />
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`Account menu for ${user?.name ?? 'this account'}`}
            onClick={() => setMenuOpen((open) => !open)}
            className={cn(
              'mt-[22px] flex w-full items-center gap-[10px] pb-[22px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage',
              isRail ? 'justify-center px-2' : 'px-[28px]',
            )}
          >
            <span aria-hidden="true" className="h-9 w-9 shrink-0 rounded-full bg-sage" />
            {!isRail && (
              <span className="min-w-0">
                <span className="block truncate text-[12px] font-semibold leading-4 text-inverse">
                  {user?.name ?? '—'}
                </span>
                <span className="mt-0.5 block truncate text-[10px] leading-[14px] text-sage">
                  {ROLE_LABEL[role]}
                </span>
              </span>
            )}
          </button>
          {menuOpen && (
            <div
              role="menu"
              className={cn(
                'absolute z-10 rounded-[10px] border border-line bg-mint p-1 shadow-lg',
                isRail ? 'bottom-6 left-full ml-3 w-48' : 'bottom-full left-[28px] right-[28px] mb-2',
              )}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => void logout()}
                className="flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-[13px] font-medium text-forest-900 hover:bg-line/60"
              >
                <LogOut aria-hidden="true" className="h-4 w-4" />
                Log out
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col lg:pl-sidebar">
        <div className="flex h-12 shrink-0 items-center gap-2 px-4 pt-1 sm:px-6 lg:px-8 xl:px-[42px]">
          <button
            type="button"
            aria-label="Open navigation"
            aria-controls="app-sidebar"
            aria-expanded={isDrawerOpen}
            onClick={() => setIsDrawerOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-btn border border-line bg-mint text-surface-600 transition-colors hover:bg-line/60 lg:hidden"
          >
            <PanelLeftOpen aria-hidden="true" className="h-[18px] w-[18px]" />
          </button>
          <button
            type="button"
            aria-label={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            aria-controls="app-sidebar"
            aria-expanded={!isCollapsed}
            onClick={toggleDesktopSidebar}
            className="hidden h-9 w-9 items-center justify-center rounded-btn border border-line bg-mint text-surface-600 transition-colors hover:bg-line/60 lg:inline-flex"
          >
            {isCollapsed ? (
              <PanelLeftOpen aria-hidden="true" className="h-[18px] w-[18px]" />
            ) : (
              <PanelLeftClose aria-hidden="true" className="h-[18px] w-[18px]" />
            )}
          </button>
        </div>

        <div
          className={cn(
            'min-w-0 flex-1 px-4 pb-10 sm:px-6 lg:px-8 xl:px-[42px] xl:pb-[42px]',
            isRail && 'lg:[&>div]:!max-w-[1284px]',
          )}
        >
          <Outlet />
        </div>
      </main>
    </div>
  );
}
