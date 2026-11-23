import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { internshipsApi } from '@/lib/api/internships';
import { useInternships } from '@/lib/queries';
import { useAuth } from '@/lib/auth/AuthContext';
import { firstName, formatDate } from '@/lib/format';
import { internshipStatuses, statusMeta } from '@/lib/status';
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

export function SupervisorDashboardPage() {
  const { user } = useAuth();
  const internships = useInternships({ mine: true, limit: 100 });
  const mine = useMemo(() => (internships.data?.results ?? []).slice(0, 50), [internships.data]);

  const submissionQueries = useQueries({
    queries: mine.map((internship) => ({
      queryKey: ['submissions', internship.id],
      queryFn: () => internshipsApi.listSubmissions(internship.id),
    })),
  });
  const evaluationQueries = useQueries({
    queries: mine.map((internship) => ({
      queryKey: ['evaluation', internship.id],
      queryFn: () => internshipsApi.getEvaluation(internship.id),
      retry: false,
    })),
  });

  const students = new Set(mine.map((internship) => internship.student_user_id)).size;
  const active = mine.filter((internship) =>
    ['confirmed', 'in_progress'].includes(internship.status),
  ).length;

  let pendingReviews = 0;
  let evaluationsToComplete = 0;
  submissionQueries.forEach((query, index) => {
    const versions = query.data?.results ?? [];
    const latest = [...versions].sort((a, b) => b.version - a.version)[0];
    if (latest?.status === 'SUBMITTED') pendingReviews += 1;
    const approved = versions.some((version) => version.status === 'APPROVED');
    if (approved && evaluationQueries[index]?.isError) evaluationsToComplete += 1;
  });

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${firstName(user?.name)}`}
        subtitle="Your assigned students, pending reviews and evaluations."
      />

      <div className="mb-8 grid grid-cols-4 gap-5">
        <StatCard label="My students" value={students} hint="Assigned to you" />
        <StatCard label="Active internships" value={active} hint="Confirmed or in progress" />
        <StatCard label="Pending reviews" value={pendingReviews} hint="Submissions awaiting review" />
        <StatCard
          label="Evaluations to complete"
          value={evaluationsToComplete}
          hint="Approved work without a grade"
        />
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-forest-900">My assigned students</h2>
          <Link to="/app/supervisor/students" className="text-xs font-semibold text-muted underline">
            View all
          </Link>
        </div>

        {internships.isLoading ? (
          <LoadingBlock label="Loading students…" />
        ) : internships.isError ? (
          <ErrorState onRetry={() => void internships.refetch()} />
        ) : mine.length === 0 ? (
          <EmptyState
            title="No students assigned"
            description="The university assigns students to you from confirmed internships."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Student</Th>
                <Th>Company</Th>
                <Th>Position</Th>
                <Th>Period</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {mine.slice(0, 8).map((internship) => (
                <tr key={internship.id}>
                  <Td className="font-semibold text-forest-900">
                    <StudentName userId={internship.student_user_id} />
                  </Td>
                  <Td>
                    <CompanyName companyUserId={internship.company_user_id} />
                  </Td>
                  <Td>
                    <OfferTitle offerId={internship.offer_id} />
                  </Td>
                  <Td className="text-muted">
                    {formatDate(internship.start_date)} → {formatDate(internship.end_date)}
                  </Td>
                  <Td>
                    <StatusPill meta={statusMeta(internshipStatuses, internship.status)} />
                  </Td>
                  <Td className="text-right">
                    <Link
                      to={`/app/supervisor/students/${internship.id}`}
                      className="text-xs font-semibold text-forest-900 underline"
                    >
                      View
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
