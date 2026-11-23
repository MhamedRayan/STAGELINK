import type { ListApplicationsParams } from '@/api/applications';
import type { ListInternshipsParams } from '@/api/internships';
import type { ListOffersParams } from '@/api/offers';

export const companyKeys = {
  all: ['company'] as const,
  dashboard: ['company', 'dashboard'] as const,
  offers: (params: ListOffersParams) => ['company', 'offers', params] as const,
  offer: (id: string) => ['company', 'offer', id] as const,
  applications: (params: ListApplicationsParams) => ['company', 'applications', params] as const,
  internships: (params: ListInternshipsParams) => ['company', 'internships', params] as const,
  cancellations: (limit: number) => ['company', 'cancellations', limit] as const,
};
