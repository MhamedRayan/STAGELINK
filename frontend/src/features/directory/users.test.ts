import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import directory from '@/demo/directory.json';
import { useDemoDirectoryUser, useUserLabel } from './users';

const student = Object.entries(directory.users).find(
  ([, user]) => user.email === 'student@stagelink.demo',
);
const STUDENT_ID = student?.[0] ?? '';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('useUserLabel', () => {
  it('uses the demo directory when VITE_DEMO_DIRECTORY=1', () => {
    vi.stubEnv('VITE_DEMO_DIRECTORY', '1');
    const { result } = renderHook(() => useUserLabel(STUDENT_ID, 'student'));
    expect(result.current).toBe('Demo Student');
  });

  it('exposes demo-only metadata for the id', () => {
    vi.stubEnv('VITE_DEMO_DIRECTORY', '1');
    const { result } = renderHook(() => useDemoDirectoryUser(STUDENT_ID));
    expect(result.current?.matricule).toBe('DEMO-2026-001');
    expect(result.current?.department).toBe('Computer Science');
  });

  it('never reads the directory in production', () => {
    vi.stubEnv('VITE_DEMO_DIRECTORY', '0');
    const { result } = renderHook(() => useUserLabel(STUDENT_ID, 'student'));
    expect(result.current).toBe('Student · 9f4c9e');
  });

  it('degrades honestly for unknown ids', () => {
    vi.stubEnv('VITE_DEMO_DIRECTORY', '1');
    const { result } = renderHook(() => useUserLabel('3f2a9c-not-in-directory', 'supervisor'));
    expect(result.current).toBe('Supervisor · 3f2a9c');
  });

  it('uses the role label when there is no id at all', () => {
    vi.stubEnv('VITE_DEMO_DIRECTORY', '1');
    const { result } = renderHook(() => useUserLabel(undefined, 'company'));
    expect(result.current).toBe('Company');
  });
});
