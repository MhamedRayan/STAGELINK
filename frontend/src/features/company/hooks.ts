import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listApplications,
  postCompanyDecision,
  type Application,
  type ListApplicationsParams,
} from '@/api/applications';
import {
  listCancellationRequests,
  listInternships,
  requestCancellation,
  type CancellationRequest,
  type Internship,
  type ListInternshipsParams,
} from '@/api/internships';
import {
  closeOffer,
  createOffer,
  deleteOffer,
  getOffer,
  listMyOffers,
  publishOffer,
  updateOffer,
  type Offer,
  type OfferWrite,
} from '@/api/offers';
import { normalizeDrfPage, normalizeOffsetPage, pageToOffset } from '@/lib/pagination';
import { companyKeys } from './keys';

const AGGREGATE_LIMIT = 100;

function useInvalidateCompany() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: companyKeys.all });
  };
}

export interface CompanyDashboardData {
  offers: Offer[];
  applications: Application[];
  activeCount: number;
  totalPlaces: number;
  pendingValidation: number;
  awaitingStudent: number;
}

export function useCompanyDashboard() {
  return useQuery<CompanyDashboardData>({
    queryKey: companyKeys.dashboard,
    queryFn: async () => {
      const [own, applications] = await Promise.all([
        listMyOffers({ page_size: AGGREGATE_LIMIT }),
        listApplications({ limit: AGGREGATE_LIMIT, offset: 0, ordering: '-created_at' }),
      ]);
      const offers = normalizeDrfPage(own).items;
      const active = offers.filter((offer) => offer.status === 'published');
      const apps = normalizeOffsetPage(applications).items;
      return {
        offers,
        applications: apps,
        activeCount: active.length,
        totalPlaces: active.reduce((sum, offer) => sum + offer.capacity, 0),
        pendingValidation: apps.filter((app) => app.status === 'COMPANY_ACCEPTED').length,
        awaitingStudent: apps.filter((app) => app.status === 'UNIVERSITY_VALIDATED').length,
      };
    },
  });
}

export interface CompanyOfferParams {
  page: number;
  status?: Offer['status'];
}

export function useCompanyOffers({ page, status }: CompanyOfferParams) {
  const params = { page, page_size: 20, ...(status ? { status } : {}) };
  return useQuery({
    queryKey: companyKeys.offers(params),
    queryFn: async () => normalizeDrfPage(await listMyOffers(params)),
    placeholderData: keepPreviousData,
  });
}

export function useCompanyOffer(id: string | undefined) {
  return useQuery({
    queryKey: companyKeys.offer(id ?? ''),
    queryFn: () => getOffer(id as string),
    enabled: Boolean(id),
    retry: false,
  });
}

export interface CompanyApplicationParams {
  page: number;
  status?: string;
}

export function useCompanyApplications({ page, status }: CompanyApplicationParams) {
  const params: ListApplicationsParams = {
    ...pageToOffset(page),
    ...(status ? { status } : {}),
    ordering: '-created_at',
  };
  return useQuery({
    queryKey: companyKeys.applications(params),
    queryFn: async () => normalizeOffsetPage(await listApplications(params)),
    placeholderData: keepPreviousData,
  });
}

export function useCompanyInternships(limit = AGGREGATE_LIMIT) {
  const params: ListInternshipsParams = { mine: true, limit, offset: 0 };
  return useQuery({
    queryKey: companyKeys.internships(params),
    queryFn: async () => normalizeOffsetPage(await listInternships(params)),
    staleTime: 60_000,
  });
}

export interface CompanyCancellationRow {
  request: CancellationRequest;
  internship: Internship;
}

/** No global endpoint: aggregate per internship, bounded to the first 100 (design-plan §3.3 Δ). */
export function useCompanyCancellations(limit = AGGREGATE_LIMIT) {
  const internships = useCompanyInternships(limit);
  return useQuery<CompanyCancellationRow[]>({
    queryKey: companyKeys.cancellations(limit),
    enabled: internships.isSuccess,
    queryFn: async () => {
      const groups = await Promise.all(
        (internships.data?.items ?? []).map(async (internship) => {
          try {
            const requests = await listCancellationRequests(internship.id);
            return requests.map((request) => ({ request, internship }));
          } catch {
            return [] as CompanyCancellationRow[];
          }
        }),
      );
      return groups.flat().sort((a, b) => b.request.created_at.localeCompare(a.request.created_at));
    },
  });
}

export function useCompanyDecision() {
  const invalidate = useInvalidateCompany();
  return useMutation({
    mutationFn: ({ id, decision, reason }: { id: string; decision: 'ACCEPT' | 'REJECT'; reason?: string }) =>
      postCompanyDecision(id, decision, reason),
    onSuccess: invalidate,
  });
}

export function useCreateOffer() {
  const invalidate = useInvalidateCompany();
  return useMutation({ mutationFn: (body: OfferWrite) => createOffer(body), onSuccess: invalidate });
}

export function useUpdateOffer() {
  const invalidate = useInvalidateCompany();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: OfferWrite }) => updateOffer(id, body),
    onSuccess: invalidate,
  });
}

export function usePublishOffer() {
  const invalidate = useInvalidateCompany();
  return useMutation({ mutationFn: publishOffer, onSuccess: invalidate });
}

export function useCloseOffer() {
  const invalidate = useInvalidateCompany();
  return useMutation({ mutationFn: closeOffer, onSuccess: invalidate });
}

export function useDeleteOffer() {
  const invalidate = useInvalidateCompany();
  return useMutation({ mutationFn: deleteOffer, onSuccess: invalidate });
}

export function useRequestCancellation() {
  const invalidate = useInvalidateCompany();
  return useMutation({
    mutationFn: ({ internshipId, reason }: { internshipId: string; reason: string }) =>
      requestCancellation(internshipId, reason),
    onSuccess: invalidate,
  });
}
