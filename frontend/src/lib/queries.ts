import { useQuery } from '@tanstack/react-query';
import { applicationsApi, type ApplicationListParams } from './api/applications';
import { identityApi } from './api/identity';
import { internshipsApi, type InternshipListParams } from './api/internships';
import { notificationsApi } from './api/notifications';
import { offersApi, type OfferListParams } from './api/offers';

export const queryKeys = {
  company: (id: string | null | undefined) => ['company', id] as const,
  offer: (id: string | null | undefined) => ['offer', id] as const,
  offers: (params: OfferListParams) => ['offers', params] as const,
  application: (id: string | null | undefined) => ['application', id] as const,
  applications: (params: ApplicationListParams) => ['applications', params] as const,
  applicationHistory: (id: string | null | undefined) => ['application-history', id] as const,
  internship: (id: string | null | undefined) => ['internship', id] as const,
  internships: (params: InternshipListParams) => ['internships', params] as const,
  submissions: (id: string | null | undefined) => ['submissions', id] as const,
  evaluation: (id: string | null | undefined) => ['evaluation', id] as const,
  cancellations: (id: string | null | undefined) => ['cancellations', id] as const,
  notifications: (page: number) => ['notifications', page] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
};

export function useCompanyProfile(companyUserId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.company(companyUserId),
    queryFn: () => identityApi.getPublicCompany(companyUserId as string),
    enabled: Boolean(companyUserId),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useOffer(id: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.offer(id),
    queryFn: () => offersApi.get(id as string),
    enabled: Boolean(id),
  });
}

export function useOffers(params: OfferListParams) {
  return useQuery({
    queryKey: queryKeys.offers(params),
    queryFn: () => offersApi.list(params),
  });
}

export function useApplications(params: ApplicationListParams, enabled = true) {
  return useQuery({
    queryKey: queryKeys.applications(params),
    queryFn: () => applicationsApi.list(params),
    enabled,
  });
}

export function useApplication(id: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.application(id),
    queryFn: () => applicationsApi.get(id as string),
    enabled: Boolean(id),
  });
}

export function useApplicationHistory(id: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.applicationHistory(id),
    queryFn: () => applicationsApi.history(id as string),
    enabled: Boolean(id),
  });
}

export function useInternships(params: InternshipListParams, enabled = true) {
  return useQuery({
    queryKey: queryKeys.internships(params),
    queryFn: () => internshipsApi.list(params),
    enabled,
  });
}

export function useInternship(id: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.internship(id),
    queryFn: () => internshipsApi.get(id as string),
    enabled: Boolean(id),
  });
}

export function useInternshipHistory(internshipId: string | null | undefined) {
  return useQuery({
    queryKey: ['internship-history', internshipId],
    queryFn: () => internshipsApi.history(internshipId as string),
    enabled: Boolean(internshipId),
  });
}

export function useSubmissions(internshipId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.submissions(internshipId),
    queryFn: () => internshipsApi.listSubmissions(internshipId as string),
    enabled: Boolean(internshipId),
  });
}

export function useEvaluation(internshipId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.evaluation(internshipId),
    queryFn: () => internshipsApi.getEvaluation(internshipId as string),
    enabled: Boolean(internshipId) && enabled,
    retry: false,
  });
}

export function useCancellations(internshipId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.cancellations(internshipId),
    queryFn: () => internshipsApi.listCancellations(internshipId as string),
    enabled: Boolean(internshipId),
  });
}

export function useUnreadCount(enabled = true) {
  return useQuery({
    queryKey: queryKeys.unreadCount,
    queryFn: notificationsApi.unreadCount,
    enabled,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}

export function useNotifications(page: number) {
  return useQuery({
    queryKey: queryKeys.notifications(page),
    queryFn: () => notificationsApi.list({ page }),
  });
}
