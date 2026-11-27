import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import {
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Pill,
  Skeleton,
  useToast,
} from '@/components/ui';
import type { Notification } from '@/api/notifications';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatDateTime, formatRelative } from '@/lib/format';
import { normalizeError } from '@/lib/errors';
import { PAGE_SIZE } from '@/lib/pagination';
import type { Role } from '@/lib/roles';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationsList,
  useUnreadCount,
} from '../hooks';
import { S } from '../strings';

/** Deep-link targets are role-specific; unknown object types stay on this page. */
function targetFor(notification: Notification, role: Role | null): string | null {
  const id = notification.related_object_id;
  switch (notification.related_object_type) {
    case 'application':
      if (role === 'student') return ROUTES.student.applicationDetail(id);
      if (role === 'university_admin') return ROUTES.university.applicationDetail(id);
      return role === 'company' ? ROUTES.company.applications : null;
    case 'internship':
      if (role === 'student') return ROUTES.student.internship;
      if (role === 'supervisor') return ROUTES.supervisor.internshipProgress(id);
      if (role === 'university_admin') return ROUTES.university.internships;
      return role === 'company' ? ROUTES.company.cancellations : null;
    case 'offer':
      return role === 'student' ? ROUTES.student.offerDetail(id) : ROUTES.company.offers;
    case 'submission':
      return role === 'student'
        ? ROUTES.student.submission
        : role === 'supervisor'
          ? ROUTES.supervisor.finalReview(id)
          : null;
    case 'cancellation':
      return role === 'university_admin'
        ? ROUTES.university.cancellations
        : role === 'company'
          ? ROUTES.company.cancellations
          : null;
    default:
      return null;
  }
}

/** Shared Notifications — Figma 25:1617 / 26:1016 / 27:856 / 28:1719. */
export function NotificationsPage() {
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const toast = useToast();
  const { role } = useAuth();
  const notifications = useNotificationsList(page);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const { data: unreadCount = 0 } = useUnreadCount();

  const open = async (notification: Notification) => {
    try {
      if (!notification.is_read) await markRead.mutateAsync(notification.id);
      const target = targetFor(notification, role);
      if (target) navigate(target);
    } catch (error) {
      toast.error(normalizeError(error).message);
    }
  };

  const markAllRead = async () => {
    try {
      const result = await markAll.mutateAsync();
      if (result.marked_read > 0) toast.success(S.allRead);
    } catch (error) {
      toast.error(normalizeError(error).message);
    }
  };

  return (
    <div className="max-w-content">
      <PageHeader
        title={S.title}
        subtitle={S.subtitle}
        action={
          <Button
            variant="secondary"
            size="sm"
            disabled={unreadCount === 0 || markAll.isPending}
            isLoading={markAll.isPending}
            onClick={() => void markAllRead()}
          >
            {S.markAll}
          </Button>
        }
      />

      {notifications.isError ? (
        <div className="mt-6">
          <ErrorState error={notifications.error} onRetry={() => void notifications.refetch()} />
        </div>
      ) : notifications.isLoading ? (
        <Skeleton className="mt-6 h-[420px] rounded-panel" />
      ) : (notifications.data?.items.length ?? 0) === 0 ? (
        <div className="mt-6">
          <EmptyState title={S.title} message={S.empty} />
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-panel border border-line bg-mint">
          <ul className="divide-y divide-line/70">
            {notifications.data?.items.map((notification) => (
              <li key={notification.id}>
                <button
                  type="button"
                  onClick={() => void open(notification)}
                  className={`flex w-full items-start gap-4 px-5 py-4 text-left hover:bg-line/40 ${
                    notification.is_read ? '' : 'bg-pill-info-bg/40'
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold text-forest-900">
                      {notification.title}
                    </span>
                    <span className="mt-1 block text-[13px] leading-5 text-ink">
                      {notification.message}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-2">
                    <Pill tone={notification.is_read ? 'neutral' : 'info'} className="h-6">
                      {notification.is_read ? S.read : S.unread}
                    </Pill>
                    <time
                      dateTime={notification.created_at}
                      title={formatDateTime(notification.created_at)}
                      className="text-[11px] text-muted"
                    >
                      {formatRelative(notification.created_at)}
                    </time>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={notifications.data?.total ?? 0}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
