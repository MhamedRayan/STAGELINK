import { useState } from 'react';
import {
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  StatusPill,
} from '@/components/ui';
import { PAGE_SIZE } from '@/lib/pagination';
import { useAdminUsers } from '../hooks';
import { S } from '../strings';

/**
 * Platform — Companies: every company account, whatever its verification status.
 * `GET /api/admin/users/?role=company` is the only endpoint that lists them all; the
 * verification queue is status-scoped, so it cannot back this screen.
 */
export function PlatformCompaniesPage() {
  const [page, setPage] = useState(1);
  const companies = useAdminUsers('company', page);

  return (
    <div className="max-w-content">
      <PageHeader title={S.companies.title} subtitle={S.companies.subtitle} />

      <div className="mt-6">
        {companies.isError ? (
          <ErrorState error={companies.error} onRetry={() => void companies.refetch()} />
        ) : (
          <div className="overflow-hidden rounded-panel border border-line">
            <DataTable
              columns={[
                {
                  key: 'company',
                  header: S.companies.columns.company,
                  render: (row) => <span className="font-semibold">{row.name}</span>,
                },
                {
                  key: 'email',
                  header: S.companies.columns.email,
                  render: (row) => row.email,
                },
                {
                  key: 'verification',
                  header: S.companies.columns.verification,
                  render: (row) =>
                    row.verification_status ? (
                      <StatusPill domain="verification" value={row.verification_status} />
                    ) : (
                      <span className="text-muted">{S.common.notProvided}</span>
                    ),
                  width: '170px',
                },
                {
                  key: 'account',
                  header: S.companies.columns.account,
                  render: (row) => (
                    <span className={row.is_active ? 'text-pill-success-fg' : 'text-muted'}>
                      {row.is_active ? S.companies.active : S.companies.inactive}
                    </span>
                  ),
                  width: '120px',
                },
              ]}
              rows={companies.data?.items ?? []}
              getRowKey={(row) => row.id}
              isLoading={companies.isLoading}
              className="rounded-none border-0"
              rowClassName="h-[68px]"
              emptyState={<EmptyState title={S.companies.title} message={S.companies.empty} />}
            />
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={companies.data?.total ?? 0}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
