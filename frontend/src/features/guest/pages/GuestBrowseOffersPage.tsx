import { useState } from 'react';
import { ROUTES } from '@/app/routes';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { OfferCard } from '@/features/offers/components/OfferCard';
import { OfferFilters, type OfferFilterValue } from '@/features/offers/components/OfferFilters';
import { OFFERS_PAGE_SIZE, useOffersList } from '@/features/offers/hooks';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { pageCount } from '@/lib/pagination';
import { S } from '../strings';

/** Browse Offers (guest) — Figma 24:18. */
export function GuestBrowseOffersPage() {
  const [filters, setFilters] = useState<OfferFilterValue>({ search: '', location: '' });
  const [page, setPage] = useState(1);
  const search = useDebouncedValue(filters.search.trim(), 300);
  const { data, isLoading, error, refetch, isFetching } = useOffersList({ search, location: filters.location, page });

  const handleFilterChange = (next: OfferFilterValue) => {
    setFilters(next);
    setPage(1);
  };
  const totalPages = data ? pageCount(data.total, OFFERS_PAGE_SIZE) : 1;

  return (
    <>
      <PublicHeader />
      <main className="px-[60px] pb-12 pt-8">
        <h1 className="text-page-title font-bold leading-[34px] text-forest-900">{S.browse.title}</h1>
        <p className="mt-1 text-[14px] leading-[17px] text-muted">{S.browse.subtitle}</p>
        <div className="mt-[21px]">
          <OfferFilters value={filters} onChange={handleFilterChange} />
        </div>

        <div className="mx-auto mt-[30px] max-w-[1280px]">
          {error ? (
            <ErrorState error={error} onRetry={() => void refetch()} />
          ) : isLoading ? (
            <div className="grid grid-cols-3 gap-x-10 gap-y-[30px]">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-[270px] rounded-panel" />
              ))}
            </div>
          ) : data && data.items.length > 0 ? (
            <>
              <div className="grid grid-cols-3 gap-x-10 gap-y-[30px]">
                {data.items.map((offer) => (
                  <OfferCard
                    key={offer.id}
                    offer={offer}
                    to={ROUTES.guest.offerDetail(offer.id)}
                    ctaLabel={S.browse.cta}
                    ctaTo={ROUTES.login}
                  />
                ))}
              </div>
              {totalPages > 1 && (
                <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-4">
                  <Button variant="secondary" disabled={page <= 1 || isFetching} onClick={() => setPage(page - 1)}>
                    Previous
                  </Button>
                  <span className="text-[13px] text-muted">
                    Page {page} of {totalPages}
                  </span>
                  <Button variant="secondary" disabled={page >= totalPages || isFetching} onClick={() => setPage(page + 1)}>
                    Next
                  </Button>
                </nav>
              )}
            </>
          ) : (
            <EmptyState title={S.browse.emptyTitle} message={S.browse.emptyMessage} />
          )}
        </div>
      </main>
    </>
  );
}
