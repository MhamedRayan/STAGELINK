import { useState } from 'react';
import type { AdminUserSummary } from '@/api/identity';
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
} from '@/components/ui';
import { PAGE_SIZE } from '@/lib/pagination';
import { EditUniversityAccountModal } from '../components/EditUniversityAccountModal';
import { useAdminUsers } from '../hooks';
import { S } from '../strings';

/** Platform — Universities: existing university_admin accounts and their institutions. */
export function PlatformUniversitiesPage() {
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<AdminUserSummary | null>(null);
  const universities = useAdminUsers('university_admin', page);

  return (
    <div className="max-w-content">
      <PageHeader title={S.universities.title} subtitle={S.universities.subtitle} />

      <div className="mt-6">
        {universities.isError ? (
          <ErrorState
            error={universities.error}
            onRetry={() => void universities.refetch()}
          />
        ) : (
          <div className="overflow-hidden rounded-panel border border-line">
            <DataTable
              columns={[
                {
                  key: 'account',
                  header: S.universities.columns.account,
                  render: (row) => <span className="font-semibold">{row.name}</span>,
                },
                {
                  key: 'institution',
                  header: S.universities.columns.institution,
                  render: (row) => row.university?.trim() || S.common.notProvided,
                },
                {
                  key: 'email',
                  header: S.universities.columns.email,
                  render: (row) => row.email,
                },
                {
                  key: 'status',
                  header: S.universities.columns.status,
                  render: (row) => (
                    <span className={row.is_active ? 'text-pill-success-fg' : 'text-muted'}>
                      {row.is_active ? S.universities.active : S.universities.inactive}
                    </span>
                  ),
                  width: '120px',
                },
                {
                  key: 'action',
                  header: S.universities.columns.action,
                  align: 'right',
                  render: (row) => (
                    <Button variant="secondary" size="sm" onClick={() => setEditing(row)}>
                      {S.common.edit}
                    </Button>
                  ),
                  width: '110px',
                },
              ]}
              rows={universities.data?.items ?? []}
              getRowKey={(row) => row.id}
              isLoading={universities.isLoading}
              className="rounded-none border-0"
              emptyState={
                <EmptyState title={S.universities.title} message={S.universities.empty} />
              }
            />
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={universities.data?.total ?? 0}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      <EditUniversityAccountModal user={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
