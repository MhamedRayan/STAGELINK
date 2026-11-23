import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { useAuth } from '@/features/auth/AuthProvider';
import { useUnreadCount } from '@/features/notifications/hooks';
import type { Role } from '@/lib/roles';

const NOTIFICATIONS_ROUTE: Partial<Record<Role, string>> = {
  student: ROUTES.student.notifications,
  company: ROUTES.company.notifications,
  university_admin: ROUTES.university.notifications,
  supervisor: ROUTES.supervisor.notifications,
};

/** Bell with a 30 s unread poll; platform admins have no notifications route. */
export function NotificationBell() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { data: unreadCount = 0 } = useUnreadCount();
  const to = role ? NOTIFICATIONS_ROUTE[role] : undefined;

  if (!to) return null;

  return (
    <button
      type="button"
      aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
      onClick={() => navigate(to)}
      className="relative flex h-9 w-9 items-center justify-center rounded-btn text-surface-600 transition-colors hover:bg-mint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface-600"
    >
      <Bell aria-hidden="true" className="h-5 w-5" />
      {unreadCount > 0 && (
        <span
          aria-hidden="true"
          className="absolute right-1 top-1 h-2 w-2 rounded-full bg-pill-danger-fg ring-2 ring-canvas"
        />
      )}
    </button>
  );
}
