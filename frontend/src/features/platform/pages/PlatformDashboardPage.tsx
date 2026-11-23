import { useNavigate } from 'react-router-dom';
import { Button, ErrorState, PageHeader, Skeleton, StatCard, StatusPill } from '@/components/ui';
import { ROUTES } from '@/app/routes';
import { useAuth } from '@/features/auth/AuthProvider';
import { CompanyLocation } from '../components/CompanyLocation';
import { useAdminCompanies, useAdminCompanyCount, useAdminUserCount } from '../hooks';
import { S } from '../strings';

function LoadingRows() {
  return (
    <>
      {[0, 1, 2].map((row) => (
        <tr key={row}>
          <td colSpan={4} className="py-4">
            <Skeleton className="h-5 w-full" />
          </td>
        </tr>
      ))}
    </>
  );
}

/** Platform — Dashboard, Figma 24:112. All counts are real (design-plan §3.6). */
export function PlatformDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const pendingCompanies = useAdminCompanies('pending', 1);
  const activeCompanies = useAdminCompanyCount('active');
  const universities = useAdminUserCount('university_admin');
  const students = useAdminUserCount('student');

  const stats = [
    {
      key: 'pending',
      ...S.dashboard.stats.pending,
      count: pendingCompanies.data?.total,
      isLoading: pendingCompanies.isLoading,
      isError: pendingCompanies.isError,
    },
    {
      key: 'active',
      ...S.dashboard.stats.active,
      count: activeCompanies.data,
      isLoading: activeCompanies.isLoading,
      isError: activeCompanies.isError,
    },
    {
      key: 'universities',
      ...S.dashboard.stats.universities,
      count: universities.data,
      isLoading: universities.isLoading,
      isError: universities.isError,
    },
    {
      key: 'students',
      ...S.dashboard.stats.students,
      count: students.data,
      isLoading: students.isLoading,
      isError: students.isError,
    },
  ];

  const companies = pendingCompanies.data?.items ?? [];

  return (
    <div className="max-w-[1080px]">
      <PageHeader title={S.dashboard.title} subtitle={S.dashboard.subtitle} />

      <h2 className="mt-[22px] text-[24px] font-semibold leading-[29px] text-forest-900">
        {S.dashboard.welcome}, {user?.name ?? 'Platform Administrator'}
      </h2>

      <div className="mt-[39px] grid grid-cols-2 gap-[13px] lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard
            key={stat.key}
            label={stat.label}
            hint={stat.hint}
            value={stat.isError ? '—' : (stat.count ?? 0)}
            isLoading={stat.isLoading}
          />
        ))}
      </div>

      <div className="mt-[26px] grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="flex min-h-[420px] flex-col rounded-panel bg-mint px-5 pt-5">
          <h2 className="text-[16px] font-semibold leading-[19px] text-forest-900">
            {S.dashboard.tableTitle}
          </h2>

          {pendingCompanies.isError ? (
            <div className="mt-5">
              <ErrorState
                error={pendingCompanies.error}
                onRetry={() => void pendingCompanies.refetch()}
              />
            </div>
          ) : (
            <table className="mt-5 w-full border-collapse text-left">
              <colgroup>
                <col className="w-[25%]" />
                <col className="w-[19.5%]" />
                <col className="w-[22%]" />
                <col />
              </colgroup>
              <thead>
                <tr className="border-b border-line text-[13px] font-medium text-muted">
                  <th className="pb-[7px] font-medium">{S.dashboard.columns.company}</th>
                  <th className="pb-[7px] font-medium">{S.dashboard.columns.location}</th>
                  <th className="pb-[7px] font-medium">{S.dashboard.columns.legalName}</th>
                  <th className="pb-[7px] font-medium">{S.dashboard.columns.status}</th>
                </tr>
              </thead>
              <tbody>
                {pendingCompanies.isLoading && <LoadingRows />}
                {!pendingCompanies.isLoading && companies.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-16 text-center">
                      <p className="text-table-body font-semibold text-forest-900">
                        {S.dashboard.emptyTitle}
                      </p>
                      <p className="mt-1 text-[12px] text-muted">{S.dashboard.emptyMessage}</p>
                    </td>
                  </tr>
                )}
                {companies.map((company) => (
                  <tr key={company.id}>
                    <td className="h-14 text-table-body text-forest-900">{company.name}</td>
                    <td className="h-14 text-table-body text-forest-900">
                      <CompanyLocation company={company} />
                    </td>
                    <td className="h-14 text-table-body text-forest-900">
                      {company.legal_name?.trim() || S.common.notProvided}
                    </td>
                    <td className="h-14">
                      <StatusPill domain="verification" value={company.verification_status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <aside className="flex min-h-[420px] flex-col rounded-panel bg-mint p-5">
          <h2 className="text-[16px] font-semibold leading-[19px] text-forest-900">
            {S.dashboard.quickActions}
          </h2>
          <div className="mt-16 space-y-3">
            <Button
              className="h-10 w-full rounded-[10px] text-[13px] font-medium"
              onClick={() => navigate(ROUTES.platform.companies)}
            >
              {S.dashboard.actions.verify}
            </Button>
            <Button
              variant="secondary"
              className="h-10 w-full rounded-[10px] text-[13px] font-medium"
              onClick={() => navigate(ROUTES.platform.createAccounts)}
            >
              {S.dashboard.actions.createUniversity}
            </Button>
            <Button
              variant="secondary"
              className="h-10 w-full rounded-[10px] text-[13px] font-medium"
              onClick={() => navigate(ROUTES.platform.createAccounts)}
            >
              {S.dashboard.actions.createCompany}
            </Button>
          </div>
          <p className="mt-8 text-[12px] leading-4 text-muted">{S.dashboard.note}</p>
        </aside>
      </div>
    </div>
  );
}
