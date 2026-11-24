import { useState } from 'react';
import { ROUTES } from '@/app/routes';
import { EmptyState, ErrorState, PageHeader, Pagination, Skeleton } from '@/components/ui';
import { OfferCard } from '@/features/offers/components/OfferCard';
import { OfferFilters, type OfferFilterValue } from '@/features/offers/components/OfferFilters';
import { OFFERS_PAGE_SIZE, useOffersList } from '@/features/offers/hooks';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { S } from '../strings';

/** Student Browse Offers — Figma 25:180. Same data as guest, student detail routes. */
export function StudentBrowseOffersPage() {
  const [filters, setFilters] = useState<OfferFilterValue>({ search: '', location: '' });
  const [page, setPage] = useState(1);
  const search = useDebouncedValue(filters.search.trim(), 300);
  const location = useDebouncedValue(filters.location, 300);
  const offers = useOffersList({ search, location, page });

  const changeFilters = (next: OfferFilterValue) => {
    setFilters(next);
    setPage(1);
  };

  return (
    <div className="max-w-content">
      <PageHeader title={S.offers.title} subtitle={S.offers.subtitle} />
      <div className="mt-[24px]">
        <OfferFilters value={filters} onChange={changeFilters} />
      </div>

      {offers.isError ? (
        <div className="mt-6">
          <ErrorState error={offers.error} onRetry={() => void offers.refetch()} />
        </div>
      ) : offers.isLoading ? (
        <div className="mt-6 grid grid-cols-1 gap-[20px] sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((key) => (
            <Skeleton key={key} className="h-[270px] rounded-panel" />
          ))}
        </div>
      ) : (offers.data?.items.length ?? 0) === 0 ? (
        <div className="mt-6">
          <EmptyState title={S.offers.emptyTitle} message={S.offers.emptyMessage} />
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-[20px] sm:grid-cols-2 xl:grid-cols-3">
            {offers.data?.items.map((offer) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                to={ROUTES.student.offerDetail(offer.id)}
                ctaLabel={S.offers.viewApply}
                ctaTo={ROUTES.student.offerDetail(offer.id)}
              />
            ))}
          </div>
          <div className="mt-6">
            <Pagination
              page={page}
              pageSize={OFFERS_PAGE_SIZE}
              total={offers.data?.total ?? 0}
              onPageChange={setPage}
            />
          </div>
        </>
      )}
    </div>
  );
}
