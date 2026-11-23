import { useMemo } from 'react';
import { useApplications, useInternships } from '@/lib/queries';
import { usePageSearch } from '@/lib/search';
import { displayUserName, displayUserMatricule } from '@/lib/demo/directory';
import { formatDate } from '@/lib/format';
import { internshipStatuses, statusMeta } from '@/lib/status';
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingBlock,
  PageHeader,
  StatusPill,
  Table,
  Td,
  Th,
} from '@/components/ui';

export function UniversityStudentsPage() {
  const applications = useApplications({ limit: 100 });
  const internships = useInternships({ limit: 100 });
  const { search } = usePageSearch();

  const rows = useMemo(() => {
    const map = new Map<
      string,
      { id: string; applications: number; internshipStatus?: string; period?: string }
    >();
    for (const application of applications.data?.results ?? []) {
      const entry = map.get(application.student_user_id) ?? {
        id: application.student_user_id,
        applications: 0,
      };
      entry.applications += 1;
      map.set(application.student_user_id, entry);
    }
    for (const internship of internships.data?.results ?? []) {
      const entry = map.get(internship.student_user_id) ?? {
        id: internship.student_user_id,
        applications: 0,
      };
      entry.internshipStatus = internship.status;
      entry.period = `${formatDate(internship.start_date)} → ${formatDate(internship.end_date)}`;
      map.set(internship.student_user_id, entry);
    }
    return Array.from(map.values()).sort((a, b) =>
      displayUserName(a.id, 'Student').localeCompare(displayUserName(b.id, 'Student')),
    );
  }, [applications.data, internships.data]);

  const filtered = rows.filter((row) => {
    if (!search.trim()) return true;
    const needle = search.toLowerCase();
    return (
      displayUserName(row.id, 'Student').toLowerCase().includes(needle) ||
      displayUserMatricule(row.id).toLowerCase().includes(needle)
    );
  });

  if (applications.isLoading || internships.isLoading) {
    return <LoadingBlock label="Loading students…" />;
  }
  if (applications.isError || internships.isError) {
    return <ErrorState onRetry={() => void applications.refetch()} />;
  }

  return (
    <div>
      <PageHeader
        title="Students"
        subtitle="Manage student accounts and academic information."
      />

      <Card className="mb-5" muted>
        <p className="text-sm text-forest-900/80">
          Accounts are provisioned by the platform administrator. This list is derived from
          students who have applications or internships.
        </p>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          title="No students found"
          description="Students appear once they have an application or internship."
        />
      ) : (
        <div className="rounded-card border border-forest-900/5 bg-white p-6 shadow-sm">
          <Table>
            <thead>
              <tr>
                <Th>Student</Th>
                <Th>Student ID</Th>
                <Th>Applications</Th>
                <Th>Internship</Th>
                <Th>Period</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <Td className="font-semibold text-forest-900">
                    {displayUserName(row.id, 'Student')}
                  </Td>
                  <Td className="text-muted">{displayUserMatricule(row.id)}</Td>
                  <Td>{row.applications}</Td>
                  <Td>
                    {row.internshipStatus ? (
                      <StatusPill meta={statusMeta(internshipStatuses, row.internshipStatus)} />
                    ) : (
                      <span className="text-xs text-muted">No internship</span>
                    )}
                  </Td>
                  <Td className="text-muted">{row.period ?? '—'}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
