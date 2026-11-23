import { useEffect, useState } from 'react';
import { useInternships } from '@/lib/queries';
import { formatDate } from '@/lib/format';
import { internshipStatuses, statusMeta } from '@/lib/status';
import type { InternshipStatus } from '@/lib/api/types';
import { CompanyName } from '@/components/CompanyName';
import { OfferTitle, StudentName, SupervisorName } from '@/components/EntityName';
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

export function UniversityInternshipsPage() {
  const [status, setStatus] = useState<InternshipStatus | ''>('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [status]);

  const internships = useInternships({
    status: status || undefined,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  return (
    <div>
      <PageHeader
        title="Internships"
        subtitle="All internships and their lifecycle status."
      />

      <div className="mb-5 w-64">
        <label htmlFor="internship-status" className="sr-only">
          Filter by status
        </label>
        <Select
          id="internship-status"
          value={status}
          onChange={(event) => setStatus(event.target.value as InternshipStatus | '')}
        >
          <option value="">All statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </Select>
      </div>

      {internships.isLoading ? (
        <LoadingBlock label="Loading internships…" />
      ) : internships.isError ? (
        <ErrorState onRetry={() => void internships.refetch()} />
      ) : !internships.data || internships.data.results.length === 0 ? (
        <EmptyState
          title="No internships in this view"
          description="Confirmed applications create internships automatically."
        />
      ) : (
        <>
          <div className="rounded-card border border-forest-900/5 bg-white p-6 shadow-sm">
            <Table>
              <thead>
                <tr>
                  <Th>Student</Th>
                  <Th>Company</Th>
                  <Th>Internship</Th>
                  <Th>Period</Th>
                  <Th>Status</Th>
                  <Th>Supervisor</Th>
                </tr>
              </thead>
              <tbody>
                {internships.data.results.map((internship) => (
                  <tr key={internship.id}>
                    <Td className="font-semibold text-forest-900">
                      <StudentName userId={internship.student_user_id} />
                    </Td>
                    <Td>
                      <CompanyName companyUserId={internship.company_user_id} />
                    </Td>
                    <Td>
                      <OfferTitle offerId={internship.offer_id} />
                    </Td>
                    <Td className="text-muted">
                      {formatDate(internship.start_date)} → {formatDate(internship.end_date)}
                    </Td>
                    <Td>
                      <StatusPill meta={statusMeta(internshipStatuses, internship.status)} />
                    </Td>
                    <Td>
                      <SupervisorName userId={internship.supervisor_user_id} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={internships.data.pagination.total}
            onChange={setPage}
          />
        </>
      )}
    </div>
  );
}
