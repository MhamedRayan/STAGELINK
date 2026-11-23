import { useState } from 'react';
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
import { PAGE_SIZE } from '@/lib/pagination';
import { formatDate } from '@/lib/format';
import { INTERNSHIP_STATUS } from '@/lib/status';
import type { Internship } from '@/api/internships';
import { StudentNameCell, SupervisorNameCell } from '../components/NameCells';
import { useUniversityInternships } from '../hooks';
import { S } from '../strings';

const STATUSES = Object.keys(INTERNSHIP_STATUS) as Internship['status'][];

/** University Internships — Figma 28:1043. */
export function UniversityInternshipsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<Internship['status'] | ''>('');
  const internships = useUniversityInternships({ page, status: status || undefined });

  return (
    <div className="max-w-content">
      <PageHeader title={S.internships.title} subtitle={S.internships.subtitle} />

      <div className="mt-[24px] flex justify-end">
        <Select
          aria-label={S.common.status}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as Internship['status'] | '');
            setPage(1);
          }}
          className="h-10 w-[220px]"
        >
          <option value="">{S.common.allStatuses}</option>
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {INTERNSHIP_STATUS[value].label}
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-5">
        {internships.isError ? (
          <ErrorState error={internships.error} onRetry={() => void internships.refetch()} />
        ) : internships.isLoading ? (
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
                  key: 'company',
                  header: S.common.company,
                  render: (row) => <CompanyNameCell companyId={row.company_user_id} />,
                },
                {
                  key: 'offer',
                  header: S.common.offer,
                  render: (row) => <OfferTitleCell offerId={row.offer_id} />,
                },
                {
                  key: 'period',
                  header: S.common.period,
                  render: (row) => `${formatDate(row.start_date)} → ${formatDate(row.end_date)}`,
                  width: '220px',
                },
                {
                  key: 'status',
                  header: S.common.status,
                  render: (row) => <StatusPill domain="internship" value={row.status} />,
                },
                {
                  key: 'supervisor',
                  header: S.common.supervisor,
                  render: (row) => (
                    <SupervisorNameCell
                      userId={row.supervisor_user_id}
                      fallback={S.common.unassigned}
                    />
                  ),
                },
              ]}
              rows={internships.data?.items ?? []}
              getRowKey={(row) => row.id}
              className="rounded-none border-0"
              rowClassName="h-[60px]"
              emptyState={<EmptyState title={S.internships.title} message={S.internships.empty} />}
            />
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={internships.data?.total ?? 0}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
