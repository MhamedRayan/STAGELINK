import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getOffer, listOffers, type ListOffersParams } from '@/api/offers';
import { normalizeDrfPage } from '@/lib/pagination';
import { offerKeys } from './keys';

export const OFFERS_PAGE_SIZE = 12;

export function useOffersList(params: { search: string; location: string; page: number }) {
  const query: ListOffersParams = {
    search: params.search || undefined,
    location: params.location || undefined,
    ordering: '-deadline',
    page: params.page,
    page_size: OFFERS_PAGE_SIZE,
  };
  return useQuery({
    queryKey: offerKeys.list(query),
    queryFn: async () => normalizeDrfPage(await listOffers(query)),
    placeholderData: keepPreviousData,
  });
}

export function useOffer(id: string | undefined) {
  return useQuery({
    queryKey: offerKeys.detail(id ?? ''),
    queryFn: () => getOffer(id as string),
    enabled: Boolean(id),
    retry: false,
  });
}

/** Distinct locations for the filter dropdown (one wide, unfiltered request). */
export function useOfferLocations() {
  return useQuery({
    queryKey: offerKeys.locations,
    queryFn: async () => {
      const { results } = await listOffers({ page_size: 100 });
      return [...new Set(results.map((o) => o.location.trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b),
      );
    },
    staleTime: 5 * 60_000,
  });
}
