import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { S } from '../strings';
import { AuthLoginPage } from './AuthLoginPage';

vi.mock('../AuthProvider', () => ({ useAuth: () => ({ login: vi.fn() }) }));

afterEach(cleanup);

describe('AuthLoginPage', () => {
  it('does not offer a forgot-password action', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthLoginPage />
      </MemoryRouter>,
    );

    expect(screen.queryByText(/forgot password/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: S.login.submit })).toBeInTheDocument();
  });
});
