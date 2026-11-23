import { http } from './http';
import type { components } from './schema/notifications';

export type Notification = components['schemas']['Notification'];
export type NotificationList = components['schemas']['NotificationList'];
export type UnreadCount = components['schemas']['UnreadCount'];
export type MarkedRead = components['schemas']['MarkedRead'];

export function getUnreadCount(): Promise<UnreadCount> {
  return http<UnreadCount>('notifications', '/api/notifications/unread-count/');
}

export function listNotifications(page = 1): Promise<NotificationList> {
  return http<NotificationList>('notifications', '/api/notifications/', { query: { page } });
}

export function markNotificationRead(id: string): Promise<Notification> {
  return http<Notification>('notifications', `/api/notifications/${id}/read/`, { method: 'PATCH' });
}

export function markAllNotificationsRead(): Promise<MarkedRead> {
  return http<MarkedRead>('notifications', '/api/notifications/read-all/', { method: 'POST' });
}
