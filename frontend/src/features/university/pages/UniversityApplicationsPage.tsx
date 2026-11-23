import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import {
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Select,
  StatusPill,
} from '@/components/ui';
import { CompanyNameCell, OfferTitleCell } from '@/features/student/components/NameCells';
import { APPLICATION_STATUS } from '@/lib/status';
import { PAGE_SIZE } from '@/lib/pagination';
import { formatDate } from '@/lib/format';
import type { ApplicationStatus } from '@/api/applications';
import { StudentNameCell } from '../components/NameCells';
import { useUniversityApplications } from '../hooks';
import { S } from '../strings';

const STATUSES = Object.keys(APPLICATION_STATUS) as ApplicationStatus[];

/** University Applications — Figma 28:541. Default queue = company-accepted. */
export function UniversityApplicationsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ApplicationStatus | ''>('COMPANY_ACCEPTED');
  const applications = useUniversityApplications({ page, status });

  return (
    <div className="max-w-content">
      <PageHeader title={S.applications.title} subtitle={S.applications.subtitle} />

      <div className="mt-[24px] flex justify-end">
        <Select
          aria-label={S.common.status}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as ApplicationStatus | '');
            setPage(1);
          }}
          className="h-10 w-[300px]"
        >
          <option value="COMPANY_ACCEPTED">{S.applications.filterPending}</option>
          <option value="">{S.applications.filterAll}</option>
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {APPLICATION_STATUS[value].label}
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-5">
        {applications.isError ? (
          <ErrorState error={applications.error} onRetry={() => void applications.refetch()} />
        ) : applications.isLoading ? (
          <div className="h-[360px] animate-pulse rounded-panel bg-line/60" />
        ) : (
          <div className="overflow-hidden rounded-panel border border-line">
            <DataTable
              columns={[
                {
                  key: 'student',
                  header: S.common.student,
                  render: (row) => <StudentNameCell userId={row.student_user_id} />,
                },
                {
                  key: 'offer',
                  header: S.common.offer,
                  render: (row) => <OfferTitleCell offerId={row.offer_id} />,
                },
                {
                  key: 'company',
                  header: S.common.company,
                  render: (row) => <CompanyNameCell companyId={row.company_user_id} />,
                },
                {
                  key: 'date',
                  header: S.applications.submittedOn,
                  render: (row) => formatDate(row.created_at),
                  width: '140px',
                },
                {
                  key: 'status',
                  header: S.common.status,
                  render: (row) => <StatusPill domain="application" value={row.status} />,
                },
                {
                  key: 'action',
                  header: S.common.action,
                  align: 'right',
                  render: (row) => (
                    <Link
                      to={ROUTES.university.applicationDetail(row.id)}
                      className="text-[13px] font-medium text-surface-600 hover:underline"
                    >
                      {row.status === 'COMPANY_ACCEPTED'
                        ? S.applications.review
                        : S.common.viewDetails}
                    </Link>
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
    </div>
  );
}
