import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lookupUsers, type UserSummary } from '@/api/identity';
import directory from '@/demo/directory.json';
import { useDirectoryUser, useUserLabel } from './users';

vi.mock('@/api/identity', () => ({ lookupUsers: vi.fn() }));
vi.mock('@/lib/session', () => ({ getAccessToken: () => 'test-access-token' }));

const student = Object.entries(directory.users).find(
  ([, user]) => user.email === 'student@stagelink.demo',
);
const STUDENT_ID = student?.[0] ?? '';

const liveStudent: UserSummary = {
  id: STUDENT_ID,
  name: 'Live Student Name',
  role: 'student',
  university: 'Demo University',
  department: 'Computer Science',
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.mocked(lookupUsers).mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('useUserLabel', () => {
  it('prefers the live directory over the demo fixture', async () => {
    vi.stubEnv('VITE_DEMO_DIRECTORY', '1');
    vi.mocked(lookupUsers).mockResolvedValue([liveStudent]);

    const { result } = renderHook(() => useUserLabel(STUDENT_ID, 'student'), { wrapper });
    await waitFor(() => expect(result.current).toBe('Live Student Name'));
    expect(lookupUsers).toHaveBeenCalledWith([STUDENT_ID]);
  });

  it('uses the live directory even when demo mode is off', async () => {
    vi.stubEnv('VITE_DEMO_DIRECTORY', '0');
    vi.mocked(lookupUsers).mockResolvedValue([liveStudent]);

    const { result } = renderHook(() => useUserLabel(STUDENT_ID, 'student'), { wrapper });
    await waitFor(() => expect(result.current).toBe('Live Student Name'));
  });

  it('falls back to the demo fixture when the id is unknown', async () => {
    vi.stubEnv('VITE_DEMO_DIRECTORY', '1');
    vi.mocked(lookupUsers).mockResolvedValue([]);

    const { result } = renderHook(() => useUserLabel(STUDENT_ID, 'student'), { wrapper });
    await waitFor(() => expect(lookupUsers).toHaveBeenCalledWith([STUDENT_ID]));
    expect(result.current).toBe('Demo Student');
  });

  it('falls back to the demo fixture when the lookup fails', async () => {
    vi.stubEnv('VITE_DEMO_DIRECTORY', '1');
    vi.mocked(lookupUsers).mockRejectedValue(new Error('Identity is down'));

    const { result } = renderHook(() => useUserLabel(STUDENT_ID, 'student'), { wrapper });
    await waitFor(() => expect(lookupUsers).toHaveBeenCalledWith([STUDENT_ID]));
    expect(result.current).toBe('Demo Student');
  });

  it('degrades honestly for unknown ids', async () => {
    vi.stubEnv('VITE_DEMO_DIRECTORY', '0');
    vi.mocked(lookupUsers).mockResolvedValue([]);

    const { result } = renderHook(() => useUserLabel('3f2a9c-not-in-directory', 'supervisor'), {
      wrapper,
    });
    await waitFor(() => expect(lookupUsers).toHaveBeenCalled());
    expect(result.current).toBe('Supervisor · 3f2a9c');
  });

  it('uses the role label when there is no id at all', () => {
    vi.mocked(lookupUsers).mockResolvedValue([]);

    const { result } = renderHook(() => useUserLabel(undefined, 'company'), { wrapper });
    expect(result.current).toBe('Company');
    expect(lookupUsers).not.toHaveBeenCalled();
  });
});

describe('useDirectoryUser', () => {
  it('exposes only the fields the caller is allowed to see', async () => {
    vi.stubEnv('VITE_DEMO_DIRECTORY', '0');
    vi.mocked(lookupUsers).mockResolvedValue([liveStudent]);

    const { result } = renderHook(() => useDirectoryUser(STUDENT_ID), { wrapper });
    await waitFor(() => expect(result.current?.name).toBe('Live Student Name'));
    expect(result.current).toMatchObject({
      university: 'Demo University',
      department: 'Computer Science',
    });
    expect(result.current?.matricule).toBeUndefined();
    expect(result.current?.email).toBeUndefined();
  });

  it('falls back to demo-only metadata for offline demo runs', async () => {
    vi.stubEnv('VITE_DEMO_DIRECTORY', '1');
    vi.mocked(lookupUsers).mockResolvedValue([]);

    const { result } = renderHook(() => useDirectoryUser(STUDENT_ID), { wrapper });
    await waitFor(() => expect(lookupUsers).toHaveBeenCalledWith([STUDENT_ID]));
    expect(result.current?.matricule).toBe('DEMO-2026-001');
    expect(result.current?.department).toBe('Computer Science');
  });
});
