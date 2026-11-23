import { useState } from 'react';
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  ReasonDialog,
  Skeleton,
  StatusPill,
  useToast,
} from '@/components/ui';
import { OfferTitleCell } from '@/features/student/components/NameCells';
import { normalizeError } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { RequesterNameCell } from '../components/NameCells';
import {
  useApproveCancellation,
  useRejectCancellation,
  useUniversityCancellations,
  type UniversityCancellationRow,
} from '../hooks';
import { S } from '../strings';

/** University Cancellation Requests — Figma 28:1215. Aggregated per internship (Δ). */
export function UniversityCancellationsPage() {
  const toast = useToast();
  const [limit, setLimit] = useState(100);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const cancellations = useUniversityCancellations(limit);
  const approve = useApproveCancellation();
  const reject = useRejectCancellation();
  const rows = cancellations.data ?? [];
  const selected = rows.find((row) => row.request.id === selectedId) ?? rows[0];

  const onApprove = async (row: UniversityCancellationRow) => {
    try {
      await approve.mutateAsync({
        internshipId: row.internship.id,
        requestId: row.request.id,
      });
      toast.success(S.cancellations.approved);
    } catch (error) {
      toast.error(normalizeError(error).message);
    }
  };

  const onReject = async (row: UniversityCancellationRow, reason: string) => {
    await reject.mutateAsync({
      internshipId: row.internship.id,
      requestId: row.request.id,
      reason,
    });
    toast.success(S.cancellations.rejected);
  };

  return (
    <div className="max-w-content">
      <PageHeader title={S.cancellations.title} subtitle={S.cancellations.subtitle} />

      {cancellations.isError ? (
        <div className="mt-6">
          <ErrorState error={cancellations.error} onRetry={() => void cancellations.refetch()} />
        </div>
      ) : cancellations.isLoading ? (
        <Skeleton className="mt-6 h-[520px] rounded-panel" />
      ) : rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState title={S.cancellations.title} message={S.cancellations.empty} />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-[700px_380px] gap-[42px]">
          <div className="min-w-0">
            <DataTable
              columns={[
                {
                  key: 'internship',
                  header: S.common.offer,
                  render: (row) => <OfferTitleCell offerId={row.internship.offer_id} />,
                },
                {
                  key: 'requester',
                  header: S.cancellations.requestedBy,
                  render: (row) => (
                    <RequesterNameCell
                      userId={row.request.requested_by_user_id}
                      role={row.request.requested_by_role}
                    />
                  ),
                },
                {
                  key: 'date',
                  header: S.cancellations.requestedOn,
                  render: (row) => formatDate(row.request.created_at),
                  width: '120px',
                },
                {
                  key: 'status',
                  header: S.common.status,
                  render: (row) => (
                    <StatusPill domain="cancellation" value={row.request.status} />
                  ),
                },
                {
                  key: 'decision',
                  header: S.cancellations.decision,
                  align: 'right',
                  render: (row) =>
                    row.request.status === 'pending' ? (
                      <Button
                        size="sm"
                        onClick={() => setSelectedId(row.request.id)}
                        disabled={selected?.request.id === row.request.id}
                      >
                        {S.cancellations.detailTitle}
                      </Button>
                    ) : (
                      <span className="text-[12px] text-muted">{S.common.processed}</span>
                    ),
                },
              ]}
              rows={rows}
              getRowKey={(row) => row.request.id}
              rowClassName="h-[60px]"
            />
            {rows.length >= limit && (
              <div className="mt-4 flex justify-center">
                <Button variant="secondary" onClick={() => setLimit((value) => value + 100)}>
                  {S.common.loadMore}
                </Button>
              </div>
            )}
          </div>

          <aside className="rounded-panel border border-line bg-mint p-5">
            <h2 className="text-[16px] font-semibold text-forest-900">
              {S.cancellations.detailTitle}
            </h2>
            {selected ? (
              <>
                <div className="mt-4">
                  <StatusPill domain="cancellation" value={selected.request.status} />
                </div>
                <p className="mt-4 text-[13px] leading-5 text-ink">{selected.request.reason}</p>
                <p className="mt-3 text-[12px] text-muted">
                  {formatDate(selected.request.created_at)}
                </p>
                {selected.request.status === 'pending' && (
                  <div className="mt-6 flex gap-3">
                    <Button
                      onClick={() => void onApprove(selected)}
                      isLoading={approve.isPending}
                    >
                      {S.cancellations.approve}
                    </Button>
                    <RejectCancellationButton
                      row={selected}
                      onReject={onReject}
                      isPending={reject.isPending}
                    />
                  </div>
                )}
              </>
            ) : (
              <p className="mt-4 text-[13px] text-muted">{S.cancellations.empty}</p>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function RejectCancellationButton({
  row,
  onReject,
  isPending,
}: {
  row: UniversityCancellationRow;
  onReject(row: UniversityCancellationRow, reason: string): Promise<void>;
  isPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)} disabled={isPending}>
        {S.cancellations.reject}
      </Button>
      <ReasonDialog
        open={open}
        onClose={() => setOpen(false)}
        title={S.cancellations.rejectTitle}
        label={S.cancellations.rejectReason}
        description={S.cancellations.rejectBody}
        confirmLabel={S.cancellations.rejectConfirm}
        required
        onConfirm={(reason) => onReject(row, reason)}
      />
    </>
  );
}
