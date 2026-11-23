export const notificationKeys = {
  all: ['notifications'] as const,
  list: (page: number) => ['notifications', 'list', page] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
};
