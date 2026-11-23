import { Link } from 'react-router-dom';
import { useInternships } from '@/lib/queries';
import { usePageSearch } from '@/lib/search';
import { displayUserName, displayUserMatricule } from '@/lib/demo/directory';
import { formatDate } from '@/lib/format';
import { internshipStatuses, statusMeta } from '@/lib/status';
import { CompanyName } from '@/components/CompanyName';
import {
  EmptyState,
  ErrorState,
  LoadingBlock,
  PageHeader,
  StatusPill,
  Table,
  Td,
  Th,
} from '@/components/ui';

export function SupervisorStudentsPage() {
  const internships = useInternships({ mine: true, limit: 100 });
  const { search } = usePageSearch();
  const rows = (internships.data?.results ?? []).filter((internship) => {
    if (!search.trim()) return true;
    const needle = search.toLowerCase();
    return (
      displayUserName(internship.student_user_id, 'Student').toLowerCase().includes(needle) ||
      displayUserMatricule(internship.student_user_id).toLowerCase().includes(needle)
    );
  });

  return (
    <div>
      <PageHeader
        title="My Students"
        subtitle="Only students assigned to you are shown."
      />

      {internships.isLoading ? (
        <LoadingBlock label="Loading students…" />
      ) : internships.isError ? (
        <ErrorState onRetry={() => void internships.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No assigned students"
          description="The university assigns students to you from confirmed internships."
        />
      ) : (
        <div className="rounded-card border border-forest-900/5 bg-white p-6 shadow-sm">
          <Table>
            <thead>
              <tr>
                <Th>Student</Th>
                <Th>Student ID</Th>
                <Th>Company</Th>
                <Th>Period</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.map((internship) => (
                <tr key={internship.id}>
                  <Td className="font-semibold text-forest-900">
                    {displayUserName(internship.student_user_id, 'Student')}
                  </Td>
                  <Td className="text-muted">{displayUserMatricule(internship.student_user_id)}</Td>
                  <Td>
                    <CompanyName companyUserId={internship.company_user_id} />
                  </Td>
                  <Td className="text-muted">
                    {formatDate(internship.start_date)} → {formatDate(internship.end_date)}
                  </Td>
                  <Td>
                    <StatusPill meta={statusMeta(internshipStatuses, internship.status)} />
                  </Td>
                  <Td className="text-right">
                    <Link
                      to={`/app/supervisor/students/${internship.id}`}
                      className="text-xs font-semibold text-forest-900 underline"
                    >
                      View
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
