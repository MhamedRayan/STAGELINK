import { useState } from 'react';
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  StatusPill,
} from '@/components/ui';
import { OfferTitleCell } from '@/features/student/components/NameCells';
import { formatDate } from '@/lib/format';
import { CancellationRequestDetail } from '../components/CancellationRequestDetail';
import { useUniversityCancellations } from '../hooks';
import { S } from '../strings';

const REQUESTER_LABEL = {
  student: S.common.student,
  company: S.common.company,
} as const;

/** University Cancellation Requests — Figma 28:1215. Aggregated per internship (Δ). */
export function UniversityCancellationsPage() {
  const [limit, setLimit] = useState(100);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const cancellations = useUniversityCancellations(limit);
  const rows = cancellations.data ?? [];
  const selected = rows.find((row) => row.request.id === selectedId) ?? null;

  if (cancellations.isError) {
    return (
      <div className="max-w-content">
        <PageHeader title={S.cancellations.title} subtitle={S.cancellations.subtitle} />
        <div className="mt-[26px]">
          <ErrorState error={cancellations.error} onRetry={() => void cancellations.refetch()} />
        </div>
      </div>
    );
  }

  if (cancellations.isLoading) {
    return (
      <div className="max-w-content">
        <PageHeader title={S.cancellations.title} subtitle={S.cancellations.subtitle} />
        <Skeleton className="mt-[26px] h-[640px] rounded-panel" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="max-w-content">
        <PageHeader title={S.cancellations.title} subtitle={S.cancellations.subtitle} />
        <div className="mt-[26px]">
          <EmptyState title={S.cancellations.title} message={S.cancellations.empty} />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-content">
      <PageHeader title={S.cancellations.title} subtitle={S.cancellations.subtitle} />

      <div className="mt-[26px] grid w-full grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,640fr)_minmax(0,440fr)]">
        <div className="min-w-0">
          <DataTable
            columns={[
              {
                key: 'internship',
                header: S.cancellations.internship,
                render: (row) => <OfferTitleCell offerId={row.internship.offer_id} />,
                width: '198px',
              },
              {
                key: 'requester',
                header: S.cancellations.requestedBy,
                render: (row) => REQUESTER_LABEL[row.request.requested_by_role],
                width: '180px',
              },
              {
                key: 'date',
                header: S.cancellations.requestedOn,
                render: (row) => formatDate(row.request.created_at),
                width: '90px',
              },
              {
                key: 'status',
                header: S.common.status,
                render: (row) => (
                  <span className="-ml-5 inline-block">
                    <StatusPill domain="cancellation" value={row.request.status} />
                  </span>
                ),
                width: '132px',
              },
            ]}
            rows={rows}
            getRowKey={(row) => row.request.id}
            onRowClick={(row) => setSelectedId(row.request.id)}
            isRowSelected={(row) => row.request.id === selectedId}
            getRowClassName={(row) =>
              row.request.id === selectedId ? 'bg-line/40' : 'hover:bg-line/40'
            }
            className="h-[640px] overflow-y-auto"
            tableClassName="table-fixed"
            headerClassName="h-[52px] px-5 py-0"
            rowClassName="h-[70px] [&>td]:px-5 [&>td]:py-0"
          />
          {rows.length >= limit && (
            <div className="mt-4 flex justify-center">
              <Button variant="secondary" onClick={() => setLimit((value) => value + 100)}>
                {S.common.loadMore}
              </Button>
            </div>
          )}
        </div>

        <CancellationRequestDetail row={selected} onDecided={() => setSelectedId(null)} />
      </div>
    </div>
  );
}
