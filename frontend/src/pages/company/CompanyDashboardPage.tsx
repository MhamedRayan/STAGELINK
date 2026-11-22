import { Link } from 'react-router-dom';
import { useApplications, useOffers, useUnreadCount } from '@/lib/queries';
import { useAuth } from '@/lib/auth/AuthContext';
import { firstName, formatDate } from '@/lib/format';
import { applicationStatuses, statusMeta } from '@/lib/status';
import { OfferTitle, StudentName } from '@/components/EntityName';
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

export function CompanyDashboardPage() {
  const { user } = useAuth();
  const offers = useOffers({ mine: true, page_size: 100 });
  const applications = useApplications({ limit: 100 });
  const unread = useUnreadCount();

  const offerRows = offers.data?.results ?? [];
  const applicationRows = applications.data?.results ?? [];
  const published = offerRows.filter((offer) => offer.status === 'published');
  const totalPlaces = published.reduce((sum, offer) => sum + offer.capacity, 0);
  const pendingValidation = applicationRows.filter((row) => row.status === 'COMPANY_ACCEPTED').length;
  const awaitingStudent = applicationRows.filter((row) => row.status === 'UNIVERSITY_VALIDATED').length;
  const recent = applicationRows.slice(0, 5);

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${firstName(user?.name)}`}
        subtitle="Your offers, incoming applications and pending decisions."
        action={
          <Link to="/app/company/offers/new">
            <Button>Post internship</Button>
          </Link>
        }
      />

      <div className="mb-8 grid grid-cols-4 gap-5">
        <StatCard label="Active offers" value={published.length} hint="Published and open" />
        <StatCard label="Total places" value={totalPlaces} hint="Across published offers" />
        <StatCard
          label="Pending university validation"
          value={pendingValidation}
          hint="Accepted by your company"
        />
        <StatCard
          label="Awaiting student decision"
          value={awaitingStudent}
          hint="Validated by the university"
        />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <Card className="col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-forest-900">Recent applications</h2>
            <Link to="/app/company/applications" className="text-xs font-semibold text-muted underline">
              View all
            </Link>
          </div>

          {applications.isLoading ? (
            <LoadingBlock label="Loading applications…" />
          ) : applications.isError ? (
            <ErrorState onRetry={() => void applications.refetch()} />
          ) : recent.length === 0 ? (
            <EmptyState
              title="No applications yet"
              description="Applications to your offers appear here."
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Student</Th>
                  <Th>Offer</Th>
                  <Th>Applied on</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {recent.map((row) => (
                  <tr key={row.id}>
                    <Td className="font-semibold text-forest-900">
                      <StudentName userId={row.student_user_id} />
                    </Td>
                    <Td>
                      <OfferTitle offerId={row.offer_id} />
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
              Notifications
            </h2>
            <p className="mt-3 text-3xl font-bold text-forest-900">
              {unread.data?.unread_count ?? 0}
            </p>
            <p className="text-xs text-muted">unread</p>
            <Link
              to="/app/company/notifications"
              className="mt-4 inline-block text-xs font-semibold text-forest-900 underline"
            >
              Open notifications
            </Link>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Quick actions
            </h2>
            <div className="mt-4 space-y-2">
              <Link to="/app/company/offers" className="block">
                <Button variant="secondary" size="sm" className="w-full justify-start">
                  Manage my offers
                </Button>
              </Link>
              <Link to="/app/company/applications" className="block">
                <Button variant="secondary" size="sm" className="w-full justify-start">
                  Review incoming requests
                </Button>
              </Link>
              <Link to="/app/company/profile" className="block">
                <Button variant="secondary" size="sm" className="w-full justify-start">
                  Complete company profile
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
