import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { cn } from '@/lib/cn';
import { ROLE_LABEL, type Role } from '@/lib/roles';
import { NAV_ITEMS } from './nav';

/**
 * TEMPORARY layout so every role can be tested before the real shell exists.
 * Person B replaces the body with <AppShell role={role}><Outlet /></AppShell>
 * (components/layout/AppShell) in task B0.
 */
export function AppLayout({ role }: { role: Role }) {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen">
      <header className="flex items-center gap-6 bg-forest-900 px-6 py-3 text-inverse">
        <strong>STAGLINK · {ROLE_LABEL[role]}</strong>
        <nav className="flex flex-wrap gap-4">
          {NAV_ITEMS[role].map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.end}
              className={({ isActive }) => cn('text-nav-text', isActive && 'font-semibold text-inverse')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <span className="ml-auto text-sage">{user?.name}</span>
        <button type="button" onClick={() => void logout()} className="rounded-btn bg-surface-600 px-3 py-1">
          Log out
        </button>
      </header>
      <main className="p-10">
        <Outlet />
      </main>
    </div>
  );
}
