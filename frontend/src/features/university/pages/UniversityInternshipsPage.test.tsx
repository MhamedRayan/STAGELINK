import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listInternships, startInternship, type Internship } from '@/api/internships';
import { ToastProvider } from '@/components/ui/Toast';
import { S } from '../strings';
import { UniversityInternshipsPage } from './UniversityInternshipsPage';

vi.mock('@/api/internships', () => ({
  listInternships: vi.fn(),
  startInternship: vi.fn(),
}));
vi.mock('@/features/student/components/NameCells', () => ({
  CompanyNameCell: () => null,
  OfferTitleCell: () => null,
}));
vi.mock('../components/NameCells', () => ({
  StudentNameCell: () => null,
  SupervisorNameCell: () => null,
}));

const confirmed: Internship = {
  id: 'a2944f61-f030-43e3-8683-c8b77b8bba7a',
  source_application_id: '11111111-1111-4111-8111-111111111111',
  student_user_id: '22222222-2222-4222-8222-222222222222',
  company_user_id: '33333333-3333-4333-8333-333333333333',
  offer_id: '44444444-4444-4444-8444-444444444444',
  supervisor_user_id: null,
  start_date: '2026-11-24',
  end_date: '2027-03-24',
  status: 'confirmed',
  created_at: '2026-11-01T08:00:00Z',
};
const inProgress: Internship = {
  ...confirmed,
  id: '7d07761a-6ce6-450d-b527-62f81d5c1e99',
  status: 'in_progress',
};

function page(items: Internship[]) {
  return {
    results: items,
    pagination: { limit: 20, offset: 0, total: items.length },
  };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <UniversityInternshipsPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(listInternships).mockReset();
  vi.mocked(startInternship).mockReset();
  vi.mocked(startInternship).mockResolvedValue({ ...confirmed, status: 'in_progress' });
});

afterEach(() => {
  cleanup();
});

describe('UniversityInternshipsPage', () => {
  it('starts only confirmed placements from the action column', async () => {
    vi.mocked(listInternships).mockResolvedValue(page([confirmed, inProgress]));
    renderPage();

    const startButtons = await screen.findAllByRole('button', {
      name: S.internships.start,
    });
    expect(startButtons).toHaveLength(1);

    fireEvent.click(startButtons[0]);

    await waitFor(() => expect(startInternship).toHaveBeenCalledWith(confirmed.id));
    expect(await screen.findByRole('status')).toHaveTextContent(S.internships.started);
  });
});
