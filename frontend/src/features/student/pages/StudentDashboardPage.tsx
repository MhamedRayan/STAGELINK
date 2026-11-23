import { useNavigate } from 'react-router-dom';
import { Briefcase, ClipboardCheck, FileText } from 'lucide-react';
import { Button, DataTable, ErrorState, PageHeader, Skeleton, StatCard, StatusPill } from '@/components/ui';
import { ROUTES } from '@/app/routes';
import { useAuth } from '@/features/auth/AuthProvider';
import { useUnreadCount } from '@/features/notifications/hooks';
import { formatDate } from '@/lib/format';
import { CompanyNameCell, OfferTitleCell } from '../components/NameCells';
import { useMyInternships, useStudentApplications } from '../hooks';
import { S } from '../strings';

const ACTIVE = ['SUBMITTED', 'COMPANY_ACCEPTED', 'UNIVERSITY_VALIDATED'];

function LoadingStats() {
  return (
    <div className="grid grid-cols-4 gap-[13px]">
      {[0, 1, 2, 3].map((key) => (
        <div key={key} className="h-[110px] rounded-[14px] bg-mint px-[18px] py-[18px]">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-4 h-7 w-16" />
        </div>
      ))}
    </div>
  );
}

/** Student Dashboard — Figma 25:2. Content x=302, stats 260×110 at y=184, panels at y=320/640. */
export function StudentDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const applications = useStudentApplications({ page: 1 });
  const internships = useMyInternships();
  const { data: unreadCount = 0 } = useUnreadCount();

  const isLoading = applications.isLoading || internships.isLoading;
  if (applications.isError || internships.isError) {
    return (
      <ErrorState
        error={applications.error ?? internships.error}
        onRetry={() => {
          void applications.refetch();
          void internships.refetch();
        }}
      />
    );
  }

  const rows = applications.data?.items ?? [];
  const filtered = rows.slice(0, 5);

  const internship = internships.data?.items[0];
  const internshipLabel = !internship
    ? S.dashboard.noInternship
    : internship.status === 'confirmed'
      ? S.dashboard.confirmed
      : internship.status === 'in_progress'
        ? S.dashboard.inProgress
        : S.dashboard.noInternship;

  return (
    <div>
      <PageHeader
        title={`${S.dashboard.welcome} ${user?.name?.split(' ')[0] ?? 'Student'}`}
        subtitle={S.dashboard.subtitle}
      />
      <h2 className="mt-[18px] text-[24px] font-semibold leading-7 text-forest-900">
        {S.dashboard.myApplications}
      </h2>

      <div className="mt-[36px]">
        {isLoading ? (
          <LoadingStats />
        ) : (
          <div className="grid grid-cols-4 gap-[13px]">
            <StatCard
              label={S.dashboard.activeApplications}
              value={rows.filter((row) => ACTIVE.includes(row.status)).length}
              hint={S.dashboard.activeHint}
            />
            <StatCard
              label={S.dashboard.awaitingDecision}
              value={rows.filter((row) => row.status === 'UNIVERSITY_VALIDATED').length}
              hint={rows.some((row) => row.status === 'UNIVERSITY_VALIDATED') ? S.dashboard.awaitingHint : S.dashboard.awaitingNone}
            />
            <StatCard
              label={S.dashboard.currentInternship}
              value={internshipLabel}
              hint={internship ? S.dashboard.internshipHint : S.dashboard.internshipNone}
            />
            <StatCard label={S.dashboard.unreadNotifications} value={unreadCount} hint={S.dashboard.unreadHint} />
          </div>
        )}
      </div>

      <div className="mt-[26px] rounded-panel bg-mint px-[18px] pb-4 pt-[20px]">
        <h3 className="mb-[18px] text-[16px] font-semibold leading-5 text-forest-900">
          {S.dashboard.myApplications}
        </h3>
        <DataTable
          columns={[
            { key: 'offer', header: S.applications.offer, render: (row) => <OfferTitleCell offerId={row.offer_id} /> },
            { key: 'company', header: S.applications.company, render: (row) => <CompanyNameCell companyId={row.company_user_id} /> },
            { key: 'applied', header: S.applications.appliedOn, render: (row) => formatDate(row.created_at) },
            { key: 'status', header: S.applications.status, render: (row) => <StatusPill domain="application" value={row.status} /> },
          ]}
          rows={filtered}
          getRowKey={(row) => row.id}
          isLoading={isLoading}
          rowClassName="h-[56px]"
          emptyState={
            <p className="px-5 py-10 text-center text-[13px] text-muted">{S.dashboard.empty}</p>
          }
        />
      </div>

      <div className="mt-[20px] rounded-panel bg-mint px-[18px] pb-[26px] pt-[20px]">
        <h3 className="mb-[20px] text-[16px] font-semibold leading-5 text-forest-900">
          {S.dashboard.quickActions}
        </h3>
        <div className="flex gap-[20px]">
          <Button
            className="h-[40px] w-[240px] rounded-[10px] text-[13px]"
            onClick={() => navigate(ROUTES.student.offers)}
          >
            <Briefcase aria-hidden="true" className="h-4 w-4" />
            {S.dashboard.browseOffers}
          </Button>
          <Button
            variant="secondary"
            className="h-[40px] w-[240px] rounded-[10px] text-[13px]"
            onClick={() => navigate(ROUTES.student.applications)}
          >
            <FileText aria-hidden="true" className="h-4 w-4" />
            {S.dashboard.viewApplications}
          </Button>
          <Button
            variant="secondary"
            className="h-[40px] w-[240px] rounded-[10px] text-[13px]"
            onClick={() => navigate(ROUTES.student.submission)}
          >
            <ClipboardCheck aria-hidden="true" className="h-4 w-4" />
            {S.dashboard.submitWork}
          </Button>
        </div>
      </div>
    </div>
  );
}
