import { useQuery } from '@tanstack/react-query';
import { getOffer } from '@/api/offers';
import { shortId } from '@/lib/ids';

export const offerSummaryKeys = {
  detail: (offerId: string) => ['offer-summary', offerId] as const,
};

/** Offer titles are absent from application/internship responses (design-plan §6.1). */
export function useOfferSummary(offerId: string | undefined) {
  return useQuery({
    queryKey: offerSummaryKeys.detail(offerId ?? ''),
    queryFn: () => getOffer(offerId as string),
    enabled: Boolean(offerId),
    staleTime: 10 * 60_000,
    retry: false,
  });
}

export function useOfferTitle(offerId: string | undefined): string {
  const { data } = useOfferSummary(offerId);
  return data?.title?.trim() || (offerId ? `Offer · ${shortId(offerId)}` : 'Offer');
}
