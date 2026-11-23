import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ArrowRight } from 'lucide-react';
import { apiRequest } from '../../api/client';
import { formatRelativeTime, formatDateTime } from '../../utils/formatters';
import { Pagination } from '../../components/ui/Pagination';

interface NotificationItem {
  id: string;
  recipient_user_id: string;
  title: string;
  message: string;
  is_read: boolean;
  related_object_type?: string;
  related_object_id?: string;
  created_at: string;
}

interface NotificationsResponse {
  count: number;
  results: NotificationItem[];
}

export const SupervisorNotifications: React.FC = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    async function loadNotifications() {
      setIsLoading(true);
      try {
        const res = await apiRequest<NotificationsResponse>(
          '/svc/notifications/api/notifications/',
          { params: { page } }
        );
        if (isMounted) {
          setNotifications(res.results || []);
          setTotalCount(res.count || 0);
        }
      } catch (err) {
        console.error('Failed to load supervisor notifications:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadNotifications();
    return () => {
      isMounted = false;
    };
  }, [page]);

  const handleNotificationClick = async (item: NotificationItem) => {
    if (!item.is_read) {
      try {
        await apiRequest(`/svc/notifications/api/notifications/${item.id}/read/`, {
          method: 'PATCH',
        });
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
        );
      } catch {
        // silent
      }
    }

    if (item.related_object_type === 'internship' && item.related_object_id) {
      navigate(`/app/supervisor/students/${item.related_object_id}`);
    } else if (item.related_object_type === 'submission' && item.related_object_id) {
      navigate(`/app/supervisor/reviews/${item.related_object_id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-forest-900 tracking-tight">Notifications</h1>
        <p className="text-xs text-mutedText mt-1">
          Opening a notification marks only that notification as read.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-mint-300/60 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex justify-center items-center">
            <div className="w-8 h-8 border-3 border-surface-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-16 text-center text-xs text-mutedText">
            <Bell className="w-8 h-8 text-mutedText/50 mx-auto mb-2" />
            No notifications in your inbox.
          </div>
        ) : (
          <div className="divide-y divide-mint-200">
            {notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`p-5 transition-colors cursor-pointer flex items-start justify-between gap-4 ${
                  !n.is_read ? 'bg-mint-100/50 hover:bg-mint-100/80' : 'hover:bg-mint-50/40'
                }`}
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {!n.is_read && (
                      <span className="w-2 h-2 rounded-full bg-forest-900 shrink-0" />
                    )}
                    <h3
                      className={`text-[13px] tracking-tight truncate ${
                        !n.is_read ? 'font-bold text-forest-900' : 'font-medium text-forest-900'
                      }`}
                    >
                      {n.title}
                    </h3>
                  </div>
                  <p className="text-xs text-forest-900/80 leading-relaxed pl-4">
                    {n.message}
                  </p>
                  <p className="text-[11px] text-mutedText pl-4" title={formatDateTime(n.created_at)}>
                    {formatRelativeTime(n.created_at)}
                  </p>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                      !n.is_read
                        ? 'bg-forest-900 text-inverseText'
                        : 'bg-mint-200 text-forest-900'
                    }`}
                  >
                    {!n.is_read ? 'Unread' : 'Read'}
                  </span>
                  <ArrowRight className="w-4 h-4 text-mutedText/60" />
                </div>
              </div>
            ))}
          </div>
        )}

        <Pagination
          totalItems={totalCount}
          pageSize={20}
          currentPage={page}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
};
