import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  Bell,
  Briefcase,
  CircleCheck,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Inbox,
  LayoutGrid,
  LogOut,
  PlusCircle,
  User,
  UserCog,
  UserPlus,
  Users,
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

/**
 * TEMPORARY shell until Person B delivers components/layout/AppShell (task B0).
 * Sidebar measurements are sampled from the Figma frames: 260 px wide, 38 px nav rows
 * (radius 10, 48 px pitch), logo at 25/23, account block at the bottom.
 */
export function AppLayout({ role }: { role: Role }) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
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

  return (
    <div className="flex min-h-screen bg-canvas">
      <aside className="sticky top-0 flex h-screen w-sidebar shrink-0 flex-col bg-forest-900">
        <div className="px-[25px] pt-[23px]">
          <div className="flex items-start gap-[7px]">
            <Logo />
            <span className="mt-[5px] text-[18px] font-bold leading-6 text-inverse">STAGLINK</span>
          </div>
          <p className="mt-2 pl-[3px] text-[13px] font-medium leading-[17px] text-sage">
            University Internship
            <br />
            Management Platform
          </p>
        </div>

        <div className="ml-6 mr-[26px] mt-[15px] h-px bg-line" />

        <nav className="mt-[18px] space-y-2.5 px-4">
          {NAV_ITEMS[role].map((item) => {
            const Icon = NAV_ICONS[item.label] ?? LayoutGrid;
            return (
              <NavLink
                key={item.label}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex h-[38px] items-center gap-[11px] rounded-[10px] px-[13px] text-[13px] transition-colors',
                    isActive
                      ? 'bg-surface-600 font-semibold text-inverse'
                      : 'font-medium text-nav-text hover:text-inverse',
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
                    {item.label}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div ref={menuRef} className="relative mt-auto">
          <div className="mx-[22px] h-px bg-line" />
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="mt-[22px] flex w-full items-center gap-[10px] px-[28px] pb-[22px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage"
          >
            <span aria-hidden="true" className="h-9 w-9 shrink-0 rounded-full bg-sage" />
            <span className="min-w-0">
              <span className="block truncate text-[12px] font-semibold leading-4 text-inverse">
                {user?.name ?? '—'}
              </span>
              <span className="mt-0.5 block truncate text-[10px] leading-[14px] text-sage">
                {ROLE_LABEL[role]}
              </span>
            </span>
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute bottom-full left-[28px] right-[28px] mb-2 rounded-[10px] border border-line bg-mint p-1 shadow-lg"
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

      <main className="min-w-0 flex-1 px-[42px] py-[42px]">
        <Outlet />
      </main>
    </div>
  );
}
