import type { ListApplicationsParams } from '@/api/applications';
import type { ListInternshipsParams } from '@/api/internships';

export const universityKeys = {
  all: ['university'] as const,
  dashboard: ['university', 'dashboard'] as const,
  students: ['university', 'students'] as const,
  supervisors: ['university', 'supervisors'] as const,
  applications: (params: ListApplicationsParams) => ['university', 'applications', params] as const,
  application: (id: string) => ['university', 'application', id] as const,
  history: (id: string) => ['university', 'application-history', id] as const,
  internships: (params: ListInternshipsParams) => ['university', 'internships', params] as const,
  assignments: ['university', 'assignments'] as const,
  cancellations: ['university', 'cancellations'] as const,
  cancellationRequests: (internshipId: string) =>
    ['university', 'cancellation-requests', internshipId] as const,
};
