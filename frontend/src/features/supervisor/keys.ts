import type { ListInternshipsParams } from '@/api/internships';

export const supervisorKeys = {
  all: ['supervisor'] as const,
  internships: (params: ListInternshipsParams) => ['supervisor', 'internships', params] as const,
  dashboard: ['supervisor', 'dashboard'] as const,
  internship: (id: string) => ['supervisor', 'internship', id] as const,
  history: (id: string) => ['supervisor', 'history', id] as const,
  submissions: (id: string) => ['supervisor', 'submissions', id] as const,
  evaluation: (id: string) => ['supervisor', 'evaluation', id] as const,
};
