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
import { getStatusInfo } from '@/lib/status';
import { EditUniversityUserModal } from '../components/EditUniversityUserModal';
import { ProvisionAccountModal } from '../components/ProvisionAccountModal';
import { StudentMatriculeCell, StudentNameCell } from '../components/NameCells';
import { useUniversityStudents } from '../hooks';
import { S } from '../strings';

/** University Students — Figma 28:184. Scoped Identity roster plus placement activity. */
export function UniversityStudentsPage() {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUserSummary | null>(null);
  const students = useUniversityStudents({ page, q: query });
  const details = useDirectoryUser(editing?.id);

  return (
    <div className="max-w-content">
      <PageHeader
        title={S.students.title}
        subtitle={S.students.subtitle}
        action={
          <div className="flex items-center gap-2">
            <Input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder={S.students.searchPlaceholder}
              aria-label={S.students.searchPlaceholder}
              className="h-9 w-[240px] rounded-full text-[12px]"
            />
            <Button onClick={() => setCreateOpen(true)}>{S.students.add}</Button>
          </div>
        }
      />

      <p className="mt-4 rounded-card border border-line bg-mint px-4 py-3 text-[13px] text-ink">
        {S.students.note}
      </p>

      <div className="mt-5">
        {students.isError ? (
          <ErrorState error={students.error} onRetry={students.refetch} />
        ) : students.isLoading ? (
          <Skeleton className="h-[360px] rounded-panel" />
        ) : (
          <div className="overflow-hidden rounded-panel border border-line">
            <DataTable
              columns={[
                {
                  key: 'student',
                  header: S.students.name,
                  render: (row) => <StudentNameCell userId={row.user.id} />,
                },
                {
                  key: 'id',
                  header: S.students.id,
                  render: (row) => <StudentMatriculeCell userId={row.user.id} />,
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
                {
                  key: 'status',
                  header: S.students.status,
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
              rows={students.rows}
              getRowKey={(row) => row.user.id}
              className="rounded-none border-0"
              emptyState={<EmptyState title={S.students.title} message={S.students.empty} />}
            />
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={students.total}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      <ProvisionAccountModal
        open={createOpen}
        role="student"
        onClose={() => setCreateOpen(false)}
      />
      <EditUniversityUserModal
        user={editing}
        role="student"
        details={details}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}
