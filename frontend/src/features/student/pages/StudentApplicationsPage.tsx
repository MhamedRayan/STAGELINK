import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Select,
  Skeleton,
  StatusPill,
} from '@/components/ui';
import { CompanyNameCell, OfferTitleCell } from '../components/NameCells';
import { useStudentApplications } from '../hooks';
import { S } from '../strings';
import { APPLICATION_STATUS } from '@/lib/status';
import { PAGE_SIZE } from '@/lib/pagination';
import { formatDate } from '@/lib/format';
import type { ApplicationStatus } from '@/api/applications';

const STATUSES = Object.keys(APPLICATION_STATUS) as ApplicationStatus[];

/** Student My Applications — Figma 25:524. Status filter + paged table. */
export function StudentApplicationsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ApplicationStatus | ''>('');

  const applications = useStudentApplications({ page, status });

  return (
    <div className="max-w-content">
      <PageHeader title={S.applications.title} subtitle={S.applications.subtitle} />

      <div className="mt-[24px] flex justify-end">
        <Select
          aria-label={S.applications.status}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as ApplicationStatus | '');
            setPage(1);
          }}
          className="h-10 w-[240px]"
        >
          <option value="">{S.applications.allStatuses}</option>
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {APPLICATION_STATUS[value].label}
            </option>
          ))}
        </Select>
      </div>

      {applications.isError ? (
        <div className="mt-6">
          <ErrorState error={applications.error} onRetry={() => void applications.refetch()} />
        </div>
      ) : applications.isLoading ? (
        <div className="mt-6">
          <Skeleton className="h-[360px] rounded-panel" />
        </div>
      ) : (applications.data?.items.length ?? 0) === 0 ? (
        <div className="mt-6">
          <EmptyState title={S.applications.title} message={S.applications.empty} />
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-panel border border-line">
          <DataTable
            columns={[
              {
                key: 'offer',
                header: S.applications.offer,
                render: (row) => <OfferTitleCell offerId={row.offer_id} />,
              },
              {
                key: 'company',
                header: S.applications.company,
                render: (row) => <CompanyNameCell companyId={row.company_user_id} />,
              },
              {
                key: 'applied',
                header: S.applications.appliedOn,
                render: (row) => formatDate(row.created_at),
              },
              {
                key: 'status',
                header: S.applications.status,
                render: (row) => <StatusPill domain="application" value={row.status} />,
              },
              {
                key: 'action',
                header: S.applications.action,
                align: 'right',
                render: (row) => (
                  <Button
                    variant="link"
                    onClick={() => navigate(ROUTES.student.applicationDetail(row.id))}
                  >
                    {S.applications.viewDetails}
                  </Button>
                ),
              },
            ]}
            rows={applications.data?.items ?? []}
            getRowKey={(row) => row.id}
            className="rounded-none border-0"
            rowClassName="h-[60px]"
            emptyState={<EmptyState title={S.applications.title} message={S.applications.empty} />}
          />
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={applications.data?.total ?? 0}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
