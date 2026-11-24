import { useState } from 'react';
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  Pagination,
  Skeleton,
} from '@/components/ui';
import type { AdminUserSummary } from '@/api/identity';
import { useDirectoryUser } from '@/features/directory/users';
import { PAGE_SIZE } from '@/lib/pagination';
import { EditUniversityUserModal } from '../components/EditUniversityUserModal';
import { ProvisionAccountModal } from '../components/ProvisionAccountModal';
import { SupervisorDepartmentCell, SupervisorNameCell } from '../components/NameCells';
import { useUniversitySupervisors } from '../hooks';
import { S } from '../strings';

/** University Supervisors — Figma 28:373. Scoped Identity roster plus assignment counts. */
export function UniversitySupervisorsPage() {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUserSummary | null>(null);
  const supervisors = useUniversitySupervisors({ page, q: query });
  const details = useDirectoryUser(editing?.id);

  return (
    <div className="max-w-content">
      <PageHeader
        title={S.supervisors.title}
        subtitle={S.supervisors.subtitle}
        action={
          <div className="flex items-center gap-2">
            <Input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder={S.supervisors.searchPlaceholder}
              aria-label={S.supervisors.searchPlaceholder}
              className="h-9 w-[240px] rounded-full text-[12px]"
            />
            <Button onClick={() => setCreateOpen(true)}>{S.supervisors.add}</Button>
          </div>
        }
      />

      <p className="mt-4 rounded-card border border-line bg-mint px-4 py-3 text-[13px] text-ink">
        {S.supervisors.note}
      </p>

      <div className="mt-5">
        {supervisors.isError ? (
          <ErrorState error={supervisors.error} onRetry={supervisors.refetch} />
        ) : supervisors.isLoading ? (
          <Skeleton className="h-[360px] rounded-panel" />
        ) : (
          <div className="overflow-hidden rounded-panel border border-line">
            <DataTable
              columns={[
                {
                  key: 'supervisor',
                  header: S.supervisors.name,
                  render: (row) => (
                    <SupervisorNameCell
                      userId={row.user.id}
                      fallback={S.common.unassigned}
                    />
                  ),
                },
                {
                  key: 'department',
                  header: S.supervisors.department,
                  render: (row) => (
                    <SupervisorDepartmentCell
                      userId={row.user.id}
                      fallback={S.supervisors.faculty}
                    />
                  ),
                },
                {
                  key: 'assigned',
                  header: S.supervisors.assigned,
                  align: 'right',
                  render: (row) =>
                    S.supervisors.assignedCount.replace('{count}', String(row.assignedCount)),
                  width: '220px',
                },
                {
                  key: 'status',
                  header: S.supervisors.status,
                  render: (row) => (
                    <span className={row.user.is_active ? 'text-pill-success-fg' : 'text-muted'}>
                      {row.user.is_active ? S.common.active : S.common.inactive}
                    </span>
                  ),
                  width: '130px',
                },
                {
                  key: 'action',
                  header: S.common.action,
                  align: 'right',
                  render: (row) => (
                    <Button variant="secondary" size="sm" onClick={() => setEditing(row.user)}>
                      {S.common.edit}
                    </Button>
                  ),
                  width: '110px',
                },
              ]}
              rows={supervisors.rows}
              getRowKey={(row) => row.user.id}
              className="rounded-none border-0"
              emptyState={<EmptyState title={S.supervisors.title} message={S.supervisors.empty} />}
            />
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={supervisors.total}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      <ProvisionAccountModal
        open={createOpen}
        role="supervisor"
        onClose={() => setCreateOpen(false)}
      />
      <EditUniversityUserModal
        user={editing}
        role="supervisor"
        details={details}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}
