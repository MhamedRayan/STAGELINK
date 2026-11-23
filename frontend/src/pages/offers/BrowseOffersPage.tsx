import { useEffect, useState } from 'react';
import { usePageSearch } from '@/lib/search';
import { useOffers } from '@/lib/queries';
import { OfferCard } from '@/components/OfferCard';
import {
  EmptyState,
  ErrorState,
  Input,
  LoadingBlock,
  PageHeader,
  Pagination,
} from '@/components/ui';

const PAGE_SIZE = 20;

export function BrowseOffersPage({
  detailBase,
  subtitle = 'Verified companies publishing internship opportunities.',
}: {
  detailBase: string;
  subtitle?: string;
}) {
  const { search } = usePageSearch();
  const [location, setLocation] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [search, location]);

  const { data, isLoading, isError, error, refetch } = useOffers({
    search: search.trim() || undefined,
    location: location.trim() || undefined,
    ordering: '-deadline',
    page,
    page_size: PAGE_SIZE,
  });

  return (
    <div>
      <PageHeader
        title="Available Internship Opportunities"
        subtitle={subtitle}
      />

      <div className="mb-6 flex gap-3">
        <div className="flex-1">
          <label htmlFor="offer-location" className="sr-only">
            Filter by location
          </label>
          <Input
            id="offer-location"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Filter by location"
          />
        </div>
        <p className="self-center text-xs text-muted">
          {data ? `${data.count} offer${data.count === 1 ? '' : 's'}` : ' '}
        </p>
      </div>

      {isLoading ? (
        <LoadingBlock label="Loading offers…" />
      ) : isError ? (
        <ErrorState message={error instanceof Error ? error.message : undefined} onRetry={() => void refetch()} />
      ) : !data || data.results.length === 0 ? (
        <EmptyState
          title="No offers match your search"
          description="Try a different keyword or clear the location filter."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-5 xl:grid-cols-3">
            {data.results.map((offer) => (
              <OfferCard key={offer.id} offer={offer} to={`${detailBase}/${offer.id}`} />
            ))}
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={data.count} onChange={setPage} />
        </>
      )}
    </div>
  );
}
