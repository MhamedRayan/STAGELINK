import type { ListApplicationsParams } from '@/api/applications';
import type { ListInternshipsParams } from '@/api/internships';

export const universityKeys = {
  all: ['university'] as const,
  dashboard: ['university', 'dashboard'] as const,
  studentRoster: (page: number, q: string) =>
    ['university', 'students', 'roster', page, q] as const,
  studentActivity: ['university', 'students', 'activity'] as const,
  supervisorRoster: (page: number, q: string) =>
    ['university', 'supervisors', 'roster', page, q] as const,
  supervisorActivity: ['university', 'supervisors', 'activity'] as const,
  supervisorOptions: ['university', 'supervisors', 'options'] as const,
  applications: (params: ListApplicationsParams) => ['university', 'applications', params] as const,
  application: (id: string) => ['university', 'application', id] as const,
  history: (id: string) => ['university', 'application-history', id] as const,
  internships: (params: ListInternshipsParams) => ['university', 'internships', params] as const,
  internship: (id: string) => ['university', 'internship', id] as const,
  assignments: ['university', 'assignments'] as const,
  cancellations: ['university', 'cancellations'] as const,
  cancellationRequests: (internshipId: string) =>
    ['university', 'cancellation-requests', internshipId] as const,
};
