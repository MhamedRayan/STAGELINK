import { useAuth } from '@/lib/auth/AuthContext';
import { useApplications, useInternships, useUnreadCount } from '@/lib/queries';
import { APPLICATION_ACTIVE } from '@/lib/status';
import { firstName } from '@/lib/format';
import { statusMeta, applicationStatuses, internshipStatuses } from '@/lib/status';
import { CompanyName } from '@/components/CompanyName';
import { OfferTitle } from '@/components/EntityName';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingBlock,
  PageHeader,
  StatCard,
  StatusPill,
  Table,
  Td,
  Th,
} from '@/components/ui';
import { formatDate } from '@/lib/format';
import { Link } from 'react-router-dom';

export function StudentDashboardPage() {
  const { user } = useAuth();
  const applications = useApplications({ limit: 5 });
  const internships = useInternships({ mine: true, limit: 100 });
  const unread = useUnreadCount();

  const rows = applications.data?.results ?? [];
  const activeCount = rows.filter((row) => APPLICATION_ACTIVE.includes(row.status)).length;
  const awaitingDecision = rows.filter((row) => row.status === 'UNIVERSITY_VALIDATED').length;
  const currentInternship = (internships.data?.results ?? []).find(
    (item) => item.status === 'confirmed' || item.status === 'in_progress',
  );

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${firstName(user?.name)}`}
        subtitle="Here is what is happening with your internship search."
      />

      <div className="mb-8 grid grid-cols-4 gap-5">
        <StatCard label="Active applications" value={activeCount} hint="Submitted or in progress" />
        <StatCard
          label="Awaiting my decision"
          value={awaitingDecision}
          hint="Validated by the university"
        />
        <StatCard
          label="Current internship"
          value={currentInternship ? 'Yes' : 'None'}
          hint={currentInternship ? 'View my internship' : 'Not placed yet'}
        />
        <StatCard
          label="Unread notifications"
          value={unread.data?.unread_count ?? 0}
          hint="Updated every 30 seconds"
        />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <Card className="col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-forest-900">My applications</h2>
            <Link to="/app/student/applications" className="text-xs font-semibold text-muted underline">
              View all
            </Link>
          </div>

          {applications.isLoading ? (
            <LoadingBlock label="Loading applications…" />
          ) : applications.isError ? (
            <ErrorState onRetry={() => void applications.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No applications yet"
              description="Browse the offers and submit your first application."
              action={
                <Link to="/app/student/offers">
                  <Button size="sm">Browse offers</Button>
                </Link>
              }
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Offer</Th>
                  <Th>Company</Th>
                  <Th>Applied on</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <Td>
                      <Link
                        to={`/app/student/applications/${row.id}`}
                        className="font-semibold text-forest-900 hover:underline"
                      >
                        <OfferTitle offerId={row.offer_id} />
                      </Link>
                    </Td>
                    <Td>
                      <CompanyName companyUserId={row.company_user_id} />
                    </Td>
                    <Td className="text-muted">{formatDate(row.created_at)}</Td>
                    <Td>
                      <StatusPill meta={statusMeta(applicationStatuses, row.status)} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <div className="space-y-6">
          <Card muted>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Current internship
            </h2>
            {currentInternship ? (
              <div className="mt-3">
                <p className="text-sm font-semibold text-forest-900">
                  <OfferTitle offerId={currentInternship.offer_id} />
                </p>
                <p className="mt-1 text-xs text-muted">
                  {formatDate(currentInternship.start_date)} →{' '}
                  {formatDate(currentInternship.end_date)}
                </p>
                <div className="mt-3">
                  <StatusPill meta={statusMeta(internshipStatuses, currentInternship.status)} />
                </div>
                <Link
                  to="/app/student/internship"
                  className="mt-4 inline-block text-xs font-semibold text-forest-900 underline"
                >
                  Open my internship
                </Link>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">
                You have no active internship. Accepted applications appear here.
              </p>
            )}
          </Card>

          <Card>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Quick actions
            </h2>
            <div className="mt-4 space-y-2">
              <Link to="/app/student/offers" className="block">
                <Button variant="secondary" size="sm" className="w-full justify-start">
                  Browse offers
                </Button>
              </Link>
              <Link to="/app/student/applications" className="block">
                <Button variant="secondary" size="sm" className="w-full justify-start">
                  View my applications
                </Button>
              </Link>
              <Link to="/app/student/internship/submission" className="block">
                <Button variant="secondary" size="sm" className="w-full justify-start">
                  Submit final work
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
