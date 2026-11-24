import { Link, useNavigate } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import {
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  StatCard,
  StatusPill,
} from '@/components/ui';
import { CompanyNameCell, OfferTitleCell } from '@/features/student/components/NameCells';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatDate } from '@/lib/format';
import { useUniversityDashboard } from '../hooks';
import { StudentNameCell } from '../components/NameCells';
import { S } from '../strings';

/** University Admin dashboard — Figma 28:2. */
export function UniversityDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const dashboard = useUniversityDashboard();

  const name = user?.name?.trim() || S.dashboard.welcomeFallback;

  return (
    <div className="max-w-content">
      <PageHeader title={S.dashboard.title} subtitle={S.dashboard.welcome.replace('{name}', name)} />

      {dashboard.isError ? (
        <div className="mt-6">
          <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} />
        </div>
      ) : dashboard.isLoading ? (
        <div className="mt-[26px] space-y-5">
          <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <StatCard key={item} label="" value="" isLoading />
            ))}
          </div>
          <Skeleton className="h-[420px] rounded-panel" />
        </div>
      ) : (
        <>
          <div className="mt-[26px] grid grid-cols-1 gap-[13px] sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label={S.dashboard.statStudents}
              value={dashboard.data?.studentCount ?? 0}
              hint={S.dashboard.statStudentsHint.replace(
                '{count}',
                String(dashboard.data?.activityStudentCount ?? 0),
              )}
              to={ROUTES.university.students}
            />
            <StatCard
              label={S.dashboard.statPending}
              value={dashboard.data?.pendingApplications.length ?? 0}
              hint={S.dashboard.statPendingHint}
              to={ROUTES.university.applications}
            />
            <StatCard
              label={S.dashboard.statUnassigned}
              value={dashboard.data?.unassignedCount ?? 0}
              hint={S.dashboard.statUnassignedHint}
              to={ROUTES.university.assignments}
            />
            <StatCard
              label={S.dashboard.statActive}
              value={dashboard.data?.activeCount ?? 0}
              hint={S.dashboard.statActiveHint}
              to={ROUTES.university.internships}
            />
          </div>

          <section className="mt-5 rounded-panel border border-line bg-mint">
            <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-5">
              <div>
                <h2 className="text-[16px] font-semibold text-forest-900">{S.dashboard.panelTitle}</h2>
                <p className="mt-1 text-[12px] text-muted">{S.dashboard.panelSubtitle}</p>
              </div>
              <Link
                to={ROUTES.university.applications}
                className="shrink-0 text-[13px] font-medium text-surface-600 hover:underline"
              >
                {S.dashboard.viewAll} →
              </Link>
            </div>
            <DataTable
              className="rounded-none border-0 border-t border-line"
              rowClassName="h-[56px]"
              columns={[
                {
                  key: 'student',
                  header: S.common.student,
                  render: (row) => <StudentNameCell userId={row.student_user_id} />,
                },
                {
                  key: 'offer',
                  header: S.common.offer,
                  render: (row) => <OfferTitleCell offerId={row.offer_id} />,
                },
                {
                  key: 'company',
                  header: S.common.company,
                  render: (row) => <CompanyNameCell companyId={row.company_user_id} />,
                },
                {
                  key: 'date',
                  header: S.applications.submittedOn,
                  render: (row) => formatDate(row.created_at),
                  width: '140px',
                },
                {
                  key: 'status',
                  header: S.common.status,
                  render: (row) => <StatusPill domain="application" value={row.status} />,
                },
                {
                  key: 'action',
                  header: S.common.action,
                  align: 'right',
                  render: (row) => (
                    <Link
                      to={ROUTES.university.applicationDetail(row.id)}
                      className="text-[13px] font-medium text-surface-600 hover:underline"
                    >
                      {S.dashboard.review}
                    </Link>
                  ),
                },
              ]}
              rows={dashboard.data?.pendingApplications ?? []}
              getRowKey={(row) => row.id}
              onRowClick={(row) => navigate(ROUTES.university.applicationDetail(row.id))}
              emptyState={<EmptyState title={S.dashboard.panelTitle} message={S.dashboard.empty} />}
            />
          </section>
        </>
      )}
    </div>
  );
}
