import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApplications } from '@/lib/queries';
import { formatDate } from '@/lib/format';
import { applicationStatuses, statusMeta } from '@/lib/status';
import type { ApplicationStatus } from '@/lib/api/types';
import { CompanyName } from '@/components/CompanyName';
import { OfferTitle, StudentName } from '@/components/EntityName';
import {
  EmptyState,
  ErrorState,
  LoadingBlock,
  PageHeader,
  Pagination,
  Select,
  StatusPill,
  Table,
  Td,
  Th,
} from '@/components/ui';

const PAGE_SIZE = 20;

export function UniversityApplicationsPage() {
  const [status, setStatus] = useState<ApplicationStatus | ''>('COMPANY_ACCEPTED');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [status]);

  const applications = useApplications({
    status: status || undefined,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  return (
    <div>
      <PageHeader
        title="Applications"
        subtitle="Validate or reject applications accepted by companies."
      />

      <div className="mb-5 w-72">
        <label htmlFor="university-status" className="sr-only">
          Filter by status
        </label>
        <Select
          id="university-status"
          value={status}
          onChange={(event) => setStatus(event.target.value as ApplicationStatus | '')}
        >
          <option value="">All statuses</option>
          {Object.entries(applicationStatuses).map(([value, meta]) => (
            <option key={value} value={value}>
              {meta.label}
            </option>
          ))}
        </Select>
      </div>

      {applications.isLoading ? (
        <LoadingBlock label="Loading applications…" />
      ) : applications.isError ? (
        <ErrorState onRetry={() => void applications.refetch()} />
      ) : !applications.data || applications.data.results.length === 0 ? (
        <EmptyState
          title="No applications in this view"
          description="Applications accepted by companies appear in the default queue."
        />
      ) : (
        <>
          <div className="rounded-card border border-forest-900/5 bg-white p-6 shadow-sm">
            <Table>
              <thead>
                <tr>
                  <Th>Student</Th>
                  <Th>Offer</Th>
                  <Th>Company</Th>
                  <Th>Submitted on</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {applications.data.results.map((row) => (
                  <tr key={row.id}>
                    <Td className="font-semibold text-forest-900">
                      <StudentName userId={row.student_user_id} />
                    </Td>
                    <Td>
                      <OfferTitle offerId={row.offer_id} />
                    </Td>
                    <Td>
                      <CompanyName companyUserId={row.company_user_id} />
                    </Td>
                    <Td className="text-muted">{formatDate(row.created_at)}</Td>
                    <Td>
                      <StatusPill meta={statusMeta(applicationStatuses, row.status)} />
                    </Td>
                    <Td className="text-right">
                      <Link
                        to={`/app/university/applications/${row.id}`}
                        className="text-xs font-semibold text-forest-900 underline"
                      >
                        Review
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={applications.data.pagination.total}
            onChange={setPage}
          />
        </>
      )}
    </div>
  );
}
