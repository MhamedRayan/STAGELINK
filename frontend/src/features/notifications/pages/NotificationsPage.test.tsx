import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Notification } from '@/api/notifications';
import { ToastProvider } from '@/components/ui/Toast';
import { S } from '../strings';
import { NotificationsPage } from './NotificationsPage';

const { markAllAsync, unread } = vi.hoisted(() => ({
  markAllAsync: vi.fn(),
  unread: { value: 1 },
}));

const notification: Notification = {
  id: '11111111-1111-4111-8111-111111111111',
  type: 'application_confirmed',
  title: 'Application confirmed',
  message: 'Your application was confirmed.',
  related_object_type: '',
  related_object_id: '',
  is_read: false,
  created_at: '2026-11-27T10:00:00Z',
  read_at: null,
};

vi.mock('@/features/auth/AuthProvider', () => ({ useAuth: () => ({ role: 'student' }) }));
vi.mock('../hooks', () => ({
  useNotificationsList: () => ({
    isError: false,
    isLoading: false,
    data: { items: [notification], total: 1 },
    refetch: vi.fn(),
  }),
  useMarkNotificationRead: () => ({ mutateAsync: vi.fn() }),
  useMarkAllNotificationsRead: () => ({ mutateAsync: markAllAsync, isPending: false }),
  useUnreadCount: () => ({ data: unread.value }),
}));

function renderPage() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ToastProvider>
        <NotificationsPage />
      </ToastProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  unread.value = 1;
  markAllAsync.mockReset();
  markAllAsync.mockResolvedValue({ marked_read: 1 });
});

afterEach(cleanup);

describe('NotificationsPage', () => {
  it('marks every notification as read from the header action', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: S.markAll }));

    await waitFor(() => expect(markAllAsync).toHaveBeenCalledOnce());
    expect(await screen.findByRole('status')).toHaveTextContent(S.allRead);
  });

  it('disables the bulk action when there is nothing unread', () => {
    unread.value = 0;
    renderPage();

    expect(screen.getByRole('button', { name: S.markAll })).toBeDisabled();
    expect(markAllAsync).not.toHaveBeenCalled();
  });
});
