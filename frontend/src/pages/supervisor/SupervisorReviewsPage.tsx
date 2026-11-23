import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { internshipsApi } from '@/lib/api/internships';
import { useInternships } from '@/lib/queries';
import { displayUserName } from '@/lib/demo/directory';
import { formatDate } from '@/lib/format';
import { internshipStatuses, statusMeta, submissionStatuses } from '@/lib/status';
import { CompanyName } from '@/components/CompanyName';
import { OfferTitle } from '@/components/EntityName';
import {
  EmptyState,
  ErrorState,
  LoadingBlock,
  PageHeader,
  StatusPill,
  Table,
  Td,
  Th,
} from '@/components/ui';

export function SupervisorReviewsPage() {
  const internships = useInternships({ mine: true, limit: 100 });
  const mine = useMemo(() => internships.data?.results ?? [], [internships.data]);

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

  const rows = mine
    .map((internship, index) => {
      const versions = submissionQueries[index]?.data?.results ?? [];
      const latest = [...versions].sort((a, b) => b.version - a.version)[0];
      const approved = versions.find((version) => version.status === 'APPROVED');
      const hasEvaluation = Boolean(evaluationQueries[index]?.data);
      return { internship, latest, approved, hasEvaluation };
    })
    .filter((row) => row.latest);

  if (internships.isLoading) return <LoadingBlock label="Loading final reviews…" />;
  if (internships.isError) {
    return <ErrorState onRetry={() => void internships.refetch()} />;
  }

  return (
    <div>
      <PageHeader
        title="Final Reviews"
        subtitle="Review submitted work and record the final evaluation."
      />

      {rows.length === 0 ? (
        <EmptyState
          title="Nothing to review"
          description="Submitted work from your assigned students appears here."
        />
      ) : (
        <div className="rounded-card border border-forest-900/5 bg-white p-6 shadow-sm">
          <Table>
            <thead>
              <tr>
                <Th>Student</Th>
                <Th>Company</Th>
                <Th>Position</Th>
                <Th>Latest submission</Th>
                <Th>Review</Th>
                <Th>Evaluation</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ internship, latest, approved, hasEvaluation }) => (
                <tr key={internship.id}>
                  <Td className="font-semibold text-forest-900">
                    {displayUserName(internship.student_user_id, 'Student')}
                  </Td>
                  <Td>
                    <CompanyName companyUserId={internship.company_user_id} />
                  </Td>
                  <Td>
                    <OfferTitle offerId={internship.offer_id} />
                    <span className="mt-0.5 block text-xs text-muted">
                      {formatDate(internship.start_date)} → {formatDate(internship.end_date)}
                    </span>
                  </Td>
                  <Td>
                    {latest ? (
                      <>
                        <span className="font-semibold text-forest-900">v{latest.version}</span>
                        <span className="mt-0.5 block max-w-[200px] truncate text-xs text-muted">
                          {latest.original_filename}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </Td>
                  <Td>
                    {latest ? (
                      <StatusPill meta={statusMeta(submissionStatuses, latest.status)} />
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </Td>
                  <Td>
                    {hasEvaluation ? (
                      <span className="text-xs font-semibold text-success">Recorded</span>
                    ) : approved ? (
                      <span className="text-xs font-semibold text-warning">Required</span>
                    ) : (
                      <span className="text-xs text-muted">Pending approval</span>
                    )}
                  </Td>
                  <Td className="text-right">
                    <Link
                      to={`/app/supervisor/reviews/${internship.id}`}
                      className="text-xs font-semibold text-forest-900 underline"
                    >
                      Open review
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      <p className="mt-4 text-xs text-muted">
        Internship statuses: {Object.values(internshipStatuses).map((meta) => meta.label).join(' · ')}.
        Reviewing work does not change the internship lifecycle.
      </p>
    </div>
  );
}
