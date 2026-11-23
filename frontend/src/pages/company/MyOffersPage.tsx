import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { offersApi } from '@/lib/api/offers';
import { useOffers } from '@/lib/queries';
import { formatDate } from '@/lib/format';
import { offerStatuses, statusMeta } from '@/lib/status';
import type { Offer, OfferStatus } from '@/lib/api/types';
import { useToast } from '@/components/Toast';
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingBlock,
  Modal,
  PageHeader,
  Pagination,
  Select,
  StatusPill,
  Table,
  Td,
  Th,
} from '@/components/ui';

const PAGE_SIZE = 20;

export function MyOffersPage() {
  const [status, setStatus] = useState<OfferStatus | ''>('');
  const [page, setPage] = useState(1);
  const [toDelete, setToDelete] = useState<Offer | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  useEffect(() => {
    setPage(1);
  }, [status]);

  const offers = useOffers({
    mine: true,
    status: status || undefined,
    page,
    page_size: PAGE_SIZE,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['offers'] });

  const action = useMutation({
    mutationFn: async (input: { offer: Offer; kind: 'publish' | 'close' | 'delete' }) => {
      if (input.kind === 'publish') return offersApi.publish(input.offer.id);
      if (input.kind === 'close') return offersApi.close(input.offer.id);
      return offersApi.remove(input.offer.id);
    },
    onSuccess: (_data, variables) => {
      const labels = { publish: 'published', close: 'closed', delete: 'deleted' } as const;
      toast.success(`Offer ${labels[variables.kind]}.`);
      setToDelete(null);
      invalidate();
    },
    onError: (caught) => {
      toast.error(caught instanceof Error ? caught.message : 'The action could not be completed.');
    },
  });

  return (
    <div>
      <PageHeader
        title="My Offers"
        subtitle="Create, publish and close internship offers."
        action={
          <Link to="/app/company/offers/new">
            <Button>+ Create offer</Button>
          </Link>
        }
      />

      <div className="mb-5 w-64">
        <label htmlFor="offer-status" className="sr-only">
          Filter by status
        </label>
        <Select
          id="offer-status"
          value={status}
          onChange={(event) => setStatus(event.target.value as OfferStatus | '')}
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Open</option>
          <option value="closed">Closed</option>
        </Select>
      </div>

      {offers.isLoading ? (
        <LoadingBlock label="Loading offers…" />
      ) : offers.isError ? (
        <ErrorState onRetry={() => void offers.refetch()} />
      ) : !offers.data || offers.data.results.length === 0 ? (
        <EmptyState
          title="No offers yet"
          description="Post your first internship offer to start receiving applications."
          action={
            <Link to="/app/company/offers/new">
              <Button size="sm">Post internship</Button>
            </Link>
          }
        />
      ) : (
        <>
          <div className="rounded-card border border-forest-900/5 bg-white p-6 shadow-sm">
            <Table>
              <thead>
                <tr>
                  <Th>Offer</Th>
                  <Th>Places</Th>
                  <Th>Deadline</Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {offers.data.results.map((offer) => (
                  <tr key={offer.id}>
                    <Td className="font-semibold text-forest-900">
                      <Link
                        to={`/app/company/offers/${offer.id}/edit`}
                        className="hover:underline"
                      >
                        {offer.title}
                      </Link>
                      <span className="mt-0.5 block text-xs font-normal text-muted">
                        {offer.location}
                      </span>
                    </Td>
                    <Td>{offer.capacity} places</Td>
                    <Td className="text-muted">{formatDate(offer.deadline)}</Td>
                    <Td>
                      <StatusPill meta={statusMeta(offerStatuses, offer.status)} />
                    </Td>
                    <Td>
                      <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
                        <Link
                          to={`/app/company/offers/${offer.id}/edit`}
                          className="text-forest-900 underline"
                        >
                          Edit
                        </Link>
                        {offer.status === 'draft' && (
                          <button
                            type="button"
                            className="text-success underline"
                            onClick={() => action.mutate({ offer, kind: 'publish' })}
                          >
                            Publish
                          </button>
                        )}
                        {offer.status === 'published' && (
                          <button
                            type="button"
                            className="text-muted underline"
                            onClick={() => action.mutate({ offer, kind: 'close' })}
                          >
                            Close
                          </button>
                        )}
                        {offer.status === 'draft' && (
                          <button
                            type="button"
                            className="text-danger underline"
                            onClick={() => setToDelete(offer)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={offers.data.count}
            onChange={setPage}
          />
        </>
      )}

      <Modal
        open={Boolean(toDelete)}
        title="Delete draft offer"
        onClose={() => setToDelete(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={action.isPending}
              onClick={() => toDelete && action.mutate({ offer: toDelete, kind: 'delete' })}
            >
              {action.isPending ? 'Deleting…' : 'Delete offer'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          <span className="font-semibold text-forest-900">{toDelete?.title}</span> will be
          permanently removed. Only drafts can be deleted.
        </p>
      </Modal>
    </div>
  );
}
