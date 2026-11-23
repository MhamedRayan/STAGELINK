import type { ListApplicationsParams } from '@/api/applications';

export const studentKeys = {
  all: ['student'] as const,
  applications: (params: ListApplicationsParams) => ['student', 'applications', params] as const,
  application: (id: string) => ['student', 'application', id] as const,
  offerApplication: (offerId: string) => ['student', 'offer-application', offerId] as const,
  history: (id: string) => ['student', 'application-history', id] as const,
  internships: ['student', 'internships'] as const,
  cancellations: (internshipId: string) => ['student', 'cancellations', internshipId] as const,
  submissions: (internshipId: string) => ['student', 'submissions', internshipId] as const,
  evaluation: (internshipId: string) => ['student', 'evaluation', internshipId] as const,
};
