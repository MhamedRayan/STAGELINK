import { DataTable, EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui';
import { SupervisorNameCell } from '../components/NameCells';
import { useUniversitySupervisors } from '../hooks';
import { S } from '../strings';

/** University Supervisors — Figma 28:373. Derived from internships + demo directory. */
export function UniversitySupervisorsPage() {
  const supervisors = useUniversitySupervisors();

  return (
    <div className="max-w-content">
      <PageHeader title={S.supervisors.title} subtitle={S.supervisors.subtitle} />

      <p className="mt-4 rounded-card border border-line bg-mint px-4 py-3 text-[13px] text-ink">
        {S.supervisors.note}
      </p>

      <div className="mt-5">
        {supervisors.isError ? (
          <ErrorState error={supervisors.error} onRetry={() => void supervisors.refetch()} />
        ) : supervisors.isLoading ? (
          <Skeleton className="h-[360px] rounded-panel" />
        ) : (
          <DataTable
            columns={[
              {
                key: 'supervisor',
                header: S.supervisors.name,
                render: (row) => <SupervisorNameCell userId={row.userId} fallback={S.common.unassigned} />,
              },
              {
                key: 'department',
                header: S.supervisors.department,
                render: (row) => row.department,
              },
              {
                key: 'assigned',
                header: S.supervisors.assigned,
                align: 'right',
                render: (row) =>
                  S.supervisors.assignedCount.replace('{count}', String(row.assignedCount)),
                width: '220px',
              },
            ]}
            rows={supervisors.data ?? []}
            getRowKey={(row) => row.userId}
            emptyState={<EmptyState title={S.supervisors.title} message={S.supervisors.empty} />}
          />
        )}
      </div>
    </div>
  );
}
