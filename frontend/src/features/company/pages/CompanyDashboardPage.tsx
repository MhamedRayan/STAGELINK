import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  StatCard,
  StatusPill,
} from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatDate } from '@/lib/format';
import { OfferTitleCell, StudentNameCell } from '../components/NameCells';
import { useCompanyDashboard } from '../hooks';
import { S } from '../strings';

/** Company dashboard — Figma 26:2. */
export function CompanyDashboardPage() {
  const { user } = useAuth();
  const dashboard = useCompanyDashboard();
  const name = user?.name?.trim() || S.dashboard.welcomeFallback;

  return (
    <div className="max-w-content">
      <PageHeader
        title={S.dashboard.title}
        subtitle={S.dashboard.welcome.replace('{name}', name)}
        action={
          <Link to={ROUTES.company.offerNew}>
            <Button>{S.dashboard.postOffer}</Button>
          </Link>
        }
      />

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
              label={S.dashboard.statActive}
              value={dashboard.data?.activeCount ?? 0}
              hint={S.dashboard.statActiveHint}
              to={ROUTES.company.offers}
            />
            <StatCard
              label={S.dashboard.statPlaces}
              value={dashboard.data?.totalPlaces ?? 0}
              hint={S.dashboard.statPlacesHint}
              to={ROUTES.company.offers}
            />
            <StatCard
              label={S.dashboard.statPending}
              value={dashboard.data?.pendingValidation ?? 0}
              hint={S.dashboard.statPendingHint}
              to={ROUTES.company.applications}
            />
            <StatCard
              label={S.dashboard.statAwaiting}
              value={dashboard.data?.awaitingStudent ?? 0}
              hint={S.dashboard.statAwaitingHint}
              to={ROUTES.company.applications}
            />
          </div>

          <section className="mt-5 rounded-panel border border-line bg-mint">
            <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-5">
              <div>
                <h2 className="text-[16px] font-semibold text-forest-900">{S.dashboard.panelTitle}</h2>
                <p className="mt-1 text-[12px] text-muted">{S.dashboard.panelSubtitle}</p>
              </div>
              <Link
                to={ROUTES.company.applications}
                className="shrink-0 text-[13px] font-medium text-surface-600 hover:underline"
              >
                {S.common.viewAll} →
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
                  key: 'date',
                  header: S.common.appliedOn,
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
                  render: () => (
                    <Link
                      to={ROUTES.company.applications}
                      className="text-[13px] font-medium text-surface-600 hover:underline"
                    >
                      {S.common.review} →
                    </Link>
                  ),
                },
              ]}
              rows={dashboard.data?.applications.slice(0, 5) ?? []}
              getRowKey={(row) => row.id}
              emptyState={<EmptyState title={S.dashboard.panelTitle} message={S.dashboard.empty} />}
            />
          </section>
        </>
      )}
    </div>
  );
}
