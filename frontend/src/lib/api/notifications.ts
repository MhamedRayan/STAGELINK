import { request, toQuery } from './client';
import type { NotificationList } from './types';

export const notificationsApi = {
  list: (params: { page?: number } = {}) =>
    request<NotificationList>('notifications', `/api/notifications/${toQuery(params)}`),

  unreadCount: () =>
    request<{ unread_count: number }>('notifications', '/api/notifications/unread-count/'),

  markRead: (id: string) =>
    request<{ marked_read: number }>(
      'notifications',
      `/api/notifications/${encodeURIComponent(id)}/read/`,
      { method: 'PATCH' },
    ),

  markAllRead: () =>
    request<{ marked_read: number }>('notifications', '/api/notifications/read-all/', {
      method: 'POST',
    }),
};
