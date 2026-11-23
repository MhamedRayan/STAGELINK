import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import {
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Select,
  StatusPill,
  useToast,
} from '@/components/ui';
import { normalizeError } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { PAGE_SIZE } from '@/lib/pagination';
import { OFFER_STATUS } from '@/lib/status';
import type { Offer } from '@/api/offers';
import {
  useCloseOffer,
  useCompanyOffers,
  useDeleteOffer,
  usePublishOffer,
} from '../hooks';
import { S } from '../strings';

const STATUSES = Object.keys(OFFER_STATUS) as Offer['status'][];

/** Company My Offers — Figma 26:350. */
export function CompanyOffersPage() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<Offer['status'] | ''>('');
  const offers = useCompanyOffers({ page, status: status || undefined });
  const publish = usePublishOffer();
  const close = useCloseOffer();
  const remove = useDeleteOffer();
  const [toClose, setToClose] = useState<Offer | null>(null);
  const [toDelete, setToDelete] = useState<Offer | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const onPublish = async (offer: Offer) => {
    try {
      await publish.mutateAsync(offer.id);
      toast.success(S.form.published);
      setActionError(null);
    } catch (error) {
      setActionError(normalizeError(error).message);
    }
  };

  const onClose = async () => {
    if (!toClose) return;
    try {
      await close.mutateAsync(toClose.id);
      toast.success(S.offers.closeConfirm);
      setToClose(null);
      setActionError(null);
    } catch (error) {
      setActionError(normalizeError(error).message);
    }
  };

  const onDelete = async () => {
    if (!toDelete) return;
    try {
      await remove.mutateAsync(toDelete.id);
      toast.success(S.offers.deleteConfirm);
      setToDelete(null);
      setActionError(null);
    } catch (error) {
      const normalized = normalizeError(error);
      setActionError(normalized.status === 409 ? S.offers.cannotDelete : normalized.message);
    }
  };

  return (
    <div className="max-w-content">
      <PageHeader
        title={S.offers.title}
        subtitle={S.offers.subtitle}
        action={
          <Link to={ROUTES.company.offerNew}>
            <Button>{S.offers.create}</Button>
          </Link>
        }
      />

      <div className="mt-[24px] flex justify-end">
        <Select
          aria-label={S.common.filter}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as Offer['status'] | '');
            setPage(1);
          }}
          className="h-10 w-[220px]"
        >
          <option value="">{S.common.allStatuses}</option>
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {OFFER_STATUS[value].label}
            </option>
          ))}
        </Select>
      </div>

      {actionError && (
        <p role="alert" className="mt-4 rounded-card border border-line bg-mint px-4 py-3 text-[13px] text-pill-danger-fg">
          {actionError}
        </p>
      )}

      <div className="mt-5">
        {offers.isError ? (
          <ErrorState error={offers.error} onRetry={() => void offers.refetch()} />
        ) : offers.isLoading ? (
          <div className="h-[360px] animate-pulse rounded-panel bg-line/60" />
        ) : (
          <div className="overflow-hidden rounded-panel border border-line">
            <DataTable
              columns={[
                {
                  key: 'title',
                  header: S.common.offer,
                  render: (row) => <span className="font-medium text-forest-900">{row.title}</span>,
                },
                {
                  key: 'places',
                  header: S.common.places,
                  render: (row) => S.common.placesCount.replace('{count}', String(row.capacity)),
                  width: '120px',
                },
                {
                  key: 'deadline',
                  header: S.common.deadline,
                  render: (row) => formatDate(row.deadline),
                  width: '160px',
                },
                {
                  key: 'status',
                  header: S.common.status,
                  render: (row) => <StatusPill domain="offer" value={row.status} />,
                },
                {
                  key: 'actions',
                  header: S.common.actions,
                  align: 'right',
                  render: (row) => (
                    <div className="flex justify-end gap-2">
                      {row.status === 'draft' && (
                        <Button
                          size="sm"
                          onClick={() => void onPublish(row)}
                          isLoading={publish.isPending}
                          title={S.offers.publishTitle}
                        >
                          {S.offers.publish}
                        </Button>
                      )}
                      {row.status !== 'closed' && (
                        <Link to={ROUTES.company.offerEdit(row.id)}>
                          <Button variant="secondary" size="sm" title={S.offers.editTitle}>
                            {S.offers.edit}
                          </Button>
                        </Link>
                      )}
                      {row.status === 'published' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setToClose(row)}
                          title={S.offers.closeTitle}
                        >
                          {S.offers.close}
                        </Button>
                      )}
                      {row.status === 'draft' && (
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => setToDelete(row)}
                          title={S.offers.removeTitle}
                        >
                          {S.offers.remove}
                        </Button>
                      )}
                    </div>
                  ),
                },
              ]}
              rows={offers.data?.items ?? []}
              getRowKey={(row) => row.id}
              className="rounded-none border-0"
              rowClassName="h-[60px]"
              emptyState={<EmptyState title={S.offers.title} message={S.offers.empty} />}
            />
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={offers.data?.total ?? 0}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(toClose)}
        onClose={() => setToClose(null)}
        title={S.offers.closeTitleModal}
        message={S.offers.closeBody.replace('{title}', toClose?.title ?? '')}
        confirmLabel={S.offers.closeConfirm}
        destructive
        onConfirm={onClose}
      />
      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        title={S.offers.deleteTitleModal}
        message={S.offers.deleteBody}
        confirmLabel={S.offers.deleteConfirm}
        destructive
        onConfirm={onDelete}
      />
    </div>
  );
}
