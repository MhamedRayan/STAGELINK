import { Link } from 'react-router-dom';
import { useApplications, useInternships } from '@/lib/queries';
import { useAuth } from '@/lib/auth/AuthContext';
import { firstName, formatDate } from '@/lib/format';
import { applicationStatuses, statusMeta } from '@/lib/status';
import { CompanyName } from '@/components/CompanyName';
import { OfferTitle, StudentName } from '@/components/EntityName';
import {
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

export function UniversityDashboardPage() {
  const { user } = useAuth();
  const applications = useApplications({ status: 'COMPANY_ACCEPTED', limit: 100 });
  const allApplications = useApplications({ limit: 100 });
  const internships = useInternships({ limit: 100 });

  const awaiting = applications.data?.results ?? [];
  const appRows = allApplications.data?.results ?? [];
  const internshipRows = internships.data?.results ?? [];

  const studentIds = new Set([
    ...appRows.map((row) => row.student_user_id),
    ...internshipRows.map((row) => row.student_user_id),
  ]);
  const unassigned = internshipRows.filter(
    (item) => ['confirmed', 'in_progress'].includes(item.status) && !item.supervisor_user_id,
  ).length;
  const active = internshipRows.filter((item) =>
    ['confirmed', 'in_progress'].includes(item.status),
  ).length;

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${firstName(user?.name)}`}
        subtitle="Applications waiting for validation and the state of university placements."
      />

      <div className="mb-8 grid grid-cols-4 gap-5">
        <StatCard
          label="Students with activity"
          value={studentIds.size}
          hint="Distinct students in applications or internships"
        />
        <StatCard label="Awaiting validation" value={awaiting.length} hint="Accepted by companies" />
        <StatCard label="Unassigned supervisors" value={unassigned} hint="Active internships" />
        <StatCard label="Active internships" value={active} hint="Confirmed or in progress" />
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-forest-900">
            Applications awaiting university validation
          </h2>
          <Link to="/app/university/applications" className="text-xs font-semibold text-muted underline">
            Open queue
          </Link>
        </div>

        {applications.isLoading ? (
          <LoadingBlock label="Loading applications…" />
        ) : applications.isError ? (
          <ErrorState onRetry={() => void applications.refetch()} />
        ) : awaiting.length === 0 ? (
          <EmptyState
            title="Nothing to validate"
            description="Applications accepted by companies appear here."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Student</Th>
                <Th>Offer</Th>
                <Th>Company</Th>
                <Th>Applied on</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {awaiting.slice(0, 6).map((row) => (
                <tr key={row.id}>
                  <Td className="font-semibold text-forest-900">
                    <StudentName userId={row.student_user_id} />
                  </Td>
                  <Td>
                    <OfferTitle offerId={row.offer_id} />
                  </Td>
                  <Td>
                    <CompanyName companyUserId={row.company_user_id} />
                  </Td>
                  <Td className="text-muted">{formatDate(row.created_at)}</Td>
                  <Td>
                    <StatusPill meta={statusMeta(applicationStatuses, row.status)} />
                  </Td>
                  <Td className="text-right">
                    <Link
                      to={`/app/university/applications/${row.id}`}
                      className="text-xs font-semibold text-forest-900 underline"
                    >
                      Review
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <div className="mt-6 grid grid-cols-2 gap-6">
        <Card muted>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Supervisor assignment
          </h2>
          <p className="mt-2 text-3xl font-bold text-forest-900">{unassigned}</p>
          <p className="text-xs text-muted">active internships without a supervisor</p>
          <Link
            to="/app/university/assignments"
            className="mt-4 inline-block text-xs font-semibold text-forest-900 underline"
          >
            Assign supervisors
          </Link>
        </Card>
        <Card muted>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Internships
          </h2>
          <p className="mt-2 text-3xl font-bold text-forest-900">{internshipRows.length}</p>
          <p className="text-xs text-muted">total placements recorded</p>
          <Link
            to="/app/university/internships"
            className="mt-4 inline-block text-xs font-semibold text-forest-900 underline"
          >
            View all internships
          </Link>
        </Card>
      </div>
    </div>
  );
}
