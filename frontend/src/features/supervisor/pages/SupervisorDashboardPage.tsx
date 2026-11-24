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
import { useAuth } from '@/features/auth/AuthProvider';
import { CompanyNameCell, OfferTitleCell } from '@/features/student/components/NameCells';
import { StudentNameCell } from '../components/NameCells';
import { useSupervisorDashboard } from '../hooks';
import { S } from '../strings';

const REVIEW_STATE = {
  evaluated: S.dashboard.stateEvaluated,
  pending: S.dashboard.statePending,
  awaiting: S.dashboard.stateAwaiting,
  progress: S.dashboard.stateProgress,
} as const;

/** Supervisor dashboard — Figma 27:2. */
export function SupervisorDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const dashboard = useSupervisorDashboard();
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
              hint={S.dashboard.statStudentsHint}
              to={ROUTES.supervisor.students}
            />
            <StatCard
              label={S.dashboard.statActive}
              value={dashboard.data?.activeCount ?? 0}
              hint={S.dashboard.statActiveHint}
              to={ROUTES.supervisor.students}
            />
            <StatCard
              label={S.dashboard.statReviews}
              value={dashboard.data?.pendingReviews ?? 0}
              hint={S.dashboard.statReviewsHint}
              to={ROUTES.supervisor.students}
            />
            <StatCard
              label={S.dashboard.statEvaluations}
              value={dashboard.data?.evaluationsToComplete ?? 0}
              hint={S.dashboard.statEvaluationsHint}
              to={ROUTES.supervisor.students}
            />
          </div>

          <section className="mt-5 rounded-panel border border-line bg-mint">
            <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-5">
              <div>
                <h2 className="text-[16px] font-semibold text-forest-900">{S.dashboard.panelTitle}</h2>
                <p className="mt-1 text-[12px] text-muted">{S.dashboard.panelSubtitle}</p>
              </div>
              <Link
                to={ROUTES.supervisor.students}
                className="shrink-0 text-[13px] font-medium text-surface-600 hover:underline"
              >
                {S.dashboard.viewAll}
              </Link>
            </div>
            <DataTable
              className="rounded-none border-0 border-t border-line"
              rowClassName="h-[56px]"
              columns={[
                {
                  key: 'student',
                  header: S.common.student,
                  render: (row) => <StudentNameCell userId={row.internship.student_user_id} />,
                },
                {
                  key: 'company',
                  header: S.common.company,
                  render: (row) => (
                    <CompanyNameCell companyId={row.internship.company_user_id} />
                  ),
                },
                {
                  key: 'offer',
                  header: S.common.offer,
                  render: (row) => <OfferTitleCell offerId={row.internship.offer_id} />,
                },
                {
                  key: 'status',
                  header: S.common.status,
                  render: (row) => (
                    <StatusPill domain="internship" value={row.internship.status} />
                  ),
                },
                {
                  key: 'review',
                  header: S.dashboard.reviewState,
                  render: (row) => REVIEW_STATE[row.reviewState],
                },
                {
                  key: 'action',
                  header: S.common.action,
                  align: 'right',
                  render: (row) => (
                    <Link
                      to={ROUTES.supervisor.studentProfile(row.internship.id)}
                      className="text-[13px] font-medium text-surface-600 hover:underline"
                    >
                      {S.common.viewProfile}
                    </Link>
                  ),
                },
              ]}
              rows={dashboard.data?.rows ?? []}
              getRowKey={(row) => row.internship.id}
              onRowClick={(row) => navigate(ROUTES.supervisor.studentProfile(row.internship.id))}
              emptyState={<EmptyState title={S.dashboard.panelTitle} message={S.dashboard.empty} />}
            />
          </section>
        </>
      )}
    </div>
  );
}
