import { useMemo } from 'react';
import { useInternships } from '@/lib/queries';
import { usePageSearch } from '@/lib/search';
import { displayUserName } from '@/lib/demo/directory';
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingBlock,
  PageHeader,
  Table,
  Td,
  Th,
} from '@/components/ui';

export function UniversitySupervisorsPage() {
  const internships = useInternships({ limit: 100 });
  const { search } = usePageSearch();

  const rows = useMemo(() => {
    const map = new Map<string, { id: string; assigned: number; active: number }>();
    for (const internship of internships.data?.results ?? []) {
      if (!internship.supervisor_user_id) continue;
      const entry = map.get(internship.supervisor_user_id) ?? {
        id: internship.supervisor_user_id,
        assigned: 0,
        active: 0,
      };
      entry.assigned += 1;
      if (['confirmed', 'in_progress'].includes(internship.status)) entry.active += 1;
      map.set(internship.supervisor_user_id, entry);
    }
    return Array.from(map.values()).sort((a, b) =>
      displayUserName(a.id, 'Supervisor').localeCompare(displayUserName(b.id, 'Supervisor')),
    );
  }, [internships.data]);

  const filtered = rows.filter((row) =>
    displayUserName(row.id, 'Supervisor').toLowerCase().includes(search.toLowerCase()),
  );

  if (internships.isLoading) return <LoadingBlock label="Loading supervisors…" />;
  if (internships.isError) return <ErrorState onRetry={() => void internships.refetch()} />;

  return (
    <div>
      <PageHeader
        title="Supervisors"
        subtitle="Manage supervisor accounts and their assigned students."
      />

      <Card className="mb-5" muted>
        <p className="text-sm text-forest-900/80">
          Accounts are provisioned by the platform administrator. This list is derived from
          internships with an assigned supervisor.
        </p>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          title="No supervisors assigned"
          description="Assign supervisors from the Supervisor Assignment page."
        />
      ) : (
        <div className="rounded-card border border-forest-900/5 bg-white p-6 shadow-sm">
          <Table>
            <thead>
              <tr>
                <Th>Supervisor</Th>
                <Th>Assigned students</Th>
                <Th>Active internships</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <Td className="font-semibold text-forest-900">
                    {displayUserName(row.id, 'Supervisor')}
                  </Td>
                  <Td>{row.assigned}</Td>
                  <Td>{row.active}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

    </div>
  );
}
