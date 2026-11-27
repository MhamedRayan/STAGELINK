import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { S } from '../strings';
import { AuthCompanyRegisterPage } from './AuthCompanyRegisterPage';

const { mutateAsync } = vi.hoisted(() => ({ mutateAsync: vi.fn() }));
vi.mock('../hooks', () => ({ useRegisterCompany: () => ({ mutateAsync }) }));

function renderPage() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthCompanyRegisterPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mutateAsync.mockReset();
  mutateAsync.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe('AuthCompanyRegisterPage', () => {
  it('sends every company field to the registration API', async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText(S.register.nameLabel), {
      target: { value: 'EURL FARISSIA' },
    });
    fireEvent.change(screen.getByLabelText(S.register.legalFormLabel), {
      target: { value: 'EURL' },
    });
    fireEvent.change(screen.getByLabelText(S.register.locationLabel), {
      target: { value: 'Alger' },
    });
    fireEvent.change(screen.getByLabelText(S.register.registrationNumberLabel), {
      target: { value: 'RC 16/00-1234567' },
    });
    fireEvent.change(screen.getByLabelText(S.register.emailLabel), {
      target: { value: 'contact@company.dz' },
    });
    fireEvent.change(screen.getByLabelText(S.register.phoneLabel), {
      target: { value: '+213 21 55 66 77' },
    });
    const passwords = screen.getAllByLabelText(S.register.passwordLabel);
    fireEvent.change(passwords[0], { target: { value: 'StrongPassword!2026' } });
    fireEvent.change(screen.getByLabelText(S.register.confirmLabel), {
      target: { value: 'StrongPassword!2026' },
    });

    fireEvent.click(screen.getByRole('button', { name: S.register.submit }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        name: 'EURL FARISSIA',
        legal_form: 'EURL',
        location: 'Alger',
        registration_number: 'RC 16/00-1234567',
        phone: '+213 21 55 66 77',
        email: 'contact@company.dz',
        password: 'StrongPassword!2026',
      }),
    );
  });

  it('requires the four fields that used to be dropped', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: S.register.submit }));

    expect(await screen.findByText(S.register.legalFormRequired)).toBeInTheDocument();
    expect(screen.getByText(S.register.locationRequired)).toBeInTheDocument();
    expect(screen.getByText(S.register.registrationNumberRequired)).toBeInTheDocument();
    expect(screen.getByText(S.register.phoneRequired)).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
