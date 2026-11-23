import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useAuth } from '@/lib/auth/AuthContext';
import { notificationsApi } from '@/lib/api/notifications';
import { useNotifications } from '@/lib/queries';
import { usePageSearch } from '@/lib/search';
import { formatRelative, formatDateTime } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  EmptyState,
  ErrorState,
  LoadingBlock,
  PageHeader,
  Pagination,
} from '@/components/ui';

const PAGE_SIZE = 20;

export function NotificationsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useNotifications(page);
  const { search } = usePageSearch();
  const { role } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: () => toast.error('Could not mark the notification as read.'),
  });

  const rows = (data?.results ?? []).filter((item) => {
    if (!search.trim()) return true;
    const needle = search.toLowerCase();
    return (
      item.title.toLowerCase().includes(needle) || item.message.toLowerCase().includes(needle)
    );
  });

  function targetFor(type: string, id: string): string | null {
    switch (role) {
      case 'student':
        if (type === 'application') return `/app/student/applications/${id}`;
        if (type === 'internship') return '/app/student/internship';
        return null;
      case 'company':
        if (type === 'application') return '/app/company/applications';
        if (type === 'internship') return '/app/company/cancellations';
        return null;
      case 'university_admin':
        if (type === 'application') return `/app/university/applications/${id}`;
        if (type === 'internship') return '/app/university/internships';
        return null;
      case 'supervisor':
        if (type === 'internship') return `/app/supervisor/internships/${id}`;
        if (type === 'application') return '/app/supervisor/students';
        return null;
      default:
        return null;
    }
  }

  function openNotification(id: string, isRead: boolean, type: string, relatedId: string) {
    if (!isRead) markRead.mutate(id);
    const target = targetFor(type, relatedId);
    if (target) navigate(target);
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Opening a notification marks only that notification as read."
      />

      {isLoading ? (
        <LoadingBlock label="Loading notifications…" />
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No notifications"
          description={
            search ? 'No notifications match your search.' : 'You are all caught up.'
          }
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-card border border-forest-900/5 bg-white shadow-sm">
            {rows.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  openNotification(
                    item.id,
                    item.is_read,
                    item.related_object_type,
                    item.related_object_id,
                  )
                }
                className={clsx(
                  'flex w-full items-start gap-4 border-b border-forest-900/5 px-6 py-4 text-left transition last:border-b-0 hover:bg-mint/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sage',
                  !item.is_read && 'bg-mint/50',
                )}
              >
                <span
                  className={clsx(
                    'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                    item.is_read ? 'bg-forest-900/15' : 'bg-danger',
                  )}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-4">
                    <span className="text-sm font-semibold text-forest-900">{item.title}</span>
                    <span
                      className="shrink-0 text-[11px] text-muted"
                      title={formatDateTime(item.created_at)}
                    >
                      {formatRelative(item.created_at)}
                    </span>
                  </span>
                  <span className="mt-1 block text-[13px] leading-relaxed text-forest-900/75">
                    {item.message}
                  </span>
                  <span className="mt-2 inline-block text-[10px] font-semibold uppercase tracking-wider text-muted">
                    {item.is_read ? 'Read' : 'Unread'}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={data?.count ?? 0}
            onChange={setPage}
          />
        </>
      )}
    </div>
  );
}
