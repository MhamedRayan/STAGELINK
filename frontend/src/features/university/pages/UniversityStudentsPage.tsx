import { DataTable, EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui';
import { getStatusInfo } from '@/lib/status';
import { StudentMatriculeCell, StudentNameCell } from '../components/NameCells';
import { useUniversityStudents } from '../hooks';
import { S } from '../strings';

/** University Students — Figma 28:184. Derived client-side (design-plan §3.4 Δ). */
export function UniversityStudentsPage() {
  const students = useUniversityStudents();

  return (
    <div className="max-w-content">
      <PageHeader title={S.students.title} subtitle={S.students.subtitle} />

      <p className="mt-4 rounded-card border border-line bg-mint px-4 py-3 text-[13px] text-ink">
        {S.students.note}
      </p>

      <div className="mt-5">
        {students.isError ? (
          <ErrorState error={students.error} onRetry={() => void students.refetch()} />
        ) : students.isLoading ? (
          <Skeleton className="h-[360px] rounded-panel" />
        ) : (
          <DataTable
            columns={[
              {
                key: 'student',
                header: S.students.name,
                render: (row) => <StudentNameCell userId={row.userId} />,
              },
              {
                key: 'id',
                header: S.students.id,
                render: (row) => <StudentMatriculeCell userId={row.userId} />,
                width: '200px',
              },
              {
                key: 'applications',
                header: S.students.applications,
                render: (row) =>
                  S.students.applicationsCount.replace('{count}', String(row.applicationsCount)),
                width: '200px',
              },
              {
                key: 'placement',
                header: S.students.placement,
                render: (row) =>
                  row.internshipStatus
                    ? `${S.students.placementActive} (${getStatusInfo('internship', row.internshipStatus).label})`
                    : S.students.placementNone,
              },
            ]}
            rows={students.data ?? []}
            getRowKey={(row) => row.userId}
            emptyState={<EmptyState title={S.students.title} message={S.students.empty} />}
          />
        )}
      </div>
    </div>
  );
}
