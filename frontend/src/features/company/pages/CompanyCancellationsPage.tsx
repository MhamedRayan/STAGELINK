import { useState } from 'react';
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
  Select,
  Skeleton,
  StatusPill,
  Textarea,
  useToast,
} from '@/components/ui';
import { useOfferTitle } from '@/features/directory/offers';
import { normalizeError } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import type { Internship } from '@/api/internships';
import { OfferTitleCell } from '../components/NameCells';
import {
  useCompanyCancellations,
  useCompanyInternships,
  useRequestCancellation,
  type CompanyCancellationRow,
} from '../hooks';
import { S } from '../strings';

/** Company Cancellations — Figma 26:860. Per-internship aggregation (design-plan §3.3 Δ). */
export function CompanyCancellationsPage() {
  const toast = useToast();
  const internships = useCompanyInternships();
  const cancellations = useCompanyCancellations();
  const request = useRequestCancellation();
  const [selectedId, setSelectedId] = useState('');
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const ongoing = (internships.data?.items ?? []).filter(
    (item) => item.status === 'confirmed' || item.status === 'in_progress',
  );
  const selectedIdValue = selectedId || ongoing[0]?.id || '';

  const submit = async () => {
    if (!selectedIdValue) return;
    if (!reason.trim()) {
      setFormError(S.cancellations.reasonError);
      return;
    }
    setFormError(null);
    try {
      await request.mutateAsync({ internshipId: selectedIdValue, reason: reason.trim() });
      toast.success(S.cancellations.submitted);
      setReason('');
    } catch (error) {
      setFormError(normalizeError(error).message);
    }
  };

  return (
    <div className="max-w-content">
      <PageHeader title={S.cancellations.title} subtitle={S.cancellations.subtitle} />

      <section className="mt-6 rounded-panel border border-line bg-mint p-5">
        <h2 className="text-[16px] font-semibold text-forest-900">{S.cancellations.requestTitle}</h2>
        {internships.isError ? (
          <div className="mt-4">
            <ErrorState error={internships.error} onRetry={() => void internships.refetch()} />
          </div>
        ) : internships.isLoading ? (
          <Skeleton className="mt-4 h-[180px]" />
        ) : ongoing.length === 0 ? (
          <p className="mt-4 text-[13px] text-muted">{S.cancellations.noEligible}</p>
        ) : (
          <div className="mt-4 max-w-[720px] space-y-4">
            <Field label={S.cancellations.select}>
              <Select value={selectedIdValue} onChange={(event) => setSelectedId(event.target.value)}>
                {ongoing.map((item) => (
                  <InternshipOption key={item.id} internship={item} />
                ))}
              </Select>
            </Field>
            <Field label={S.cancellations.reason} error={formError ?? undefined}>
              <Textarea
                rows={4}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={S.cancellations.reasonPlaceholder}
                hasError={Boolean(formError)}
              />
            </Field>
            <Button onClick={() => void submit()} isLoading={request.isPending}>
              {S.cancellations.submit}
            </Button>
          </div>
        )}
      </section>

      <section className="mt-5 rounded-panel border border-line bg-mint p-5">
        <h2 className="text-[16px] font-semibold text-forest-900">{S.cancellations.listTitle}</h2>
        <div className="mt-4">
          {cancellations.isError ? (
            <ErrorState error={cancellations.error} onRetry={() => void cancellations.refetch()} />
          ) : cancellations.isLoading ? (
            <Skeleton className="h-[280px]" />
          ) : (
            <DataTable
              columns={[
                {
                  key: 'placement',
                  header: S.common.offer,
                  render: (row) => <OfferTitleCell offerId={row.internship.offer_id} />,
                },
                {
                  key: 'date',
                  header: S.cancellations.requestedOn,
                  render: (row) => formatDate(row.request.created_at),
                  width: '140px',
                },
                {
                  key: 'reason',
                  header: S.cancellations.sentReason,
                  render: (row) => <span className="line-clamp-2">{row.request.reason}</span>,
                },
                {
                  key: 'status',
                  header: S.common.status,
                  render: (row) => <StatusPill domain="cancellation" value={row.request.status} />,
                },
              ]}
              rows={cancellations.data ?? []}
              getRowKey={(row: CompanyCancellationRow) => row.request.id}
              rowClassName="h-[60px]"
              emptyState={
                <EmptyState title={S.cancellations.listTitle} message={S.cancellations.empty} />
              }
            />
          )}
        </div>
      </section>
    </div>
  );
}

function InternshipOption({ internship }: { internship: Internship }) {
  const title = useOfferTitle(internship.offer_id);
  return (
    <option value={internship.id}>
      {S.cancellations.placement
        .replace('{title}', title)
        .replace('{period}', `${formatDate(internship.start_date)} - ${formatDate(internship.end_date)}`)}
    </option>
  );
}
