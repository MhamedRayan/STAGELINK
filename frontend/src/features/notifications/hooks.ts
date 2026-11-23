import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/api/notifications';
import { normalizeDrfPage } from '@/lib/pagination';
import { notificationKeys } from './keys';

/** Poll every 30 s (design-plan §2 "Notifications"). */
export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unreadCount,
    queryFn: async () => (await getUnreadCount()).unread_count,
    refetchInterval: 30_000,
  });
}

export function useNotificationsList(page: number) {
  return useQuery({
    queryKey: notificationKeys.list(page),
    queryFn: async () => normalizeDrfPage(await listNotifications(page)),
    placeholderData: keepPreviousData,
  });
}

function useInvalidateNotifications() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: notificationKeys.all });
  };
}

export function useMarkNotificationRead() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: invalidate,
  });
}

export function useMarkAllNotificationsRead() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: invalidate,
  });
}
