import { Link } from 'react-router-dom';
import { useEvaluation, useInternships, useSubmissions } from '@/lib/queries';
import { displayUserName } from '@/lib/demo/directory';
import { formatDate, formatDateTime, formatGrade } from '@/lib/format';
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingBlock,
  PageHeader,
  StatCard,
} from '@/components/ui';

export function EvaluationPage() {
  const internships = useInternships({ mine: true, limit: 100 });
  const internship = (internships.data?.results ?? []).find(
    (item) => item.status === 'completed' || item.status === 'in_progress',
  );
  const evaluation = useEvaluation(internship?.id);
  const submissions = useSubmissions(internship?.id);

  if (internships.isLoading) return <LoadingBlock label="Loading evaluation…" />;
  if (internships.isError) return <ErrorState onRetry={() => void internships.refetch()} />;

  if (!internship) {
    return (
      <div>
        <PageHeader title="Evaluation" subtitle="Your final grade and supervisor feedback." />
        <EmptyState
          title="No internship yet"
          description="Your evaluation appears once your supervisor records it."
          action={
            <Link to="/app/student/internship">
              <span className="text-sm font-semibold text-forest-900 underline">
                Back to my internship
              </span>
            </Link>
          }
        />
      </div>
    );
  }

  if (evaluation.isLoading) return <LoadingBlock label="Loading evaluation…" />;

  if (evaluation.isError || !evaluation.data) {
    return (
      <div>
        <PageHeader title="Evaluation" subtitle="Your final grade and supervisor feedback." />
        <EmptyState
          title="Evaluation not available yet"
          description="Your evaluation is visible once your supervisor records it."
          action={
            <Link to="/app/student/internship">
              <span className="text-sm font-semibold text-forest-900 underline">
                Back to my internship
              </span>
            </Link>
          }
        />
      </div>
    );
  }

  const record = evaluation.data;
  const approved = (submissions.data?.results ?? []).find((item) => item.status === 'APPROVED');

  return (
    <div>
      <PageHeader
        title="Evaluation"
        subtitle="Final result recorded by your university supervisor."
      />

      <div className="mb-6 grid grid-cols-3 gap-5">
        <StatCard label="Status" value="Completed" hint="Internship lifecycle" />
        <StatCard label="Final grade" value={`${formatGrade(record.grade)} / 20`} />
        <StatCard
          label="Recorded by"
          value={displayUserName(record.supervisor_user_id, 'Supervisor')}
          hint={formatDate(record.created_at)}
        />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <Card className="col-span-2">
          <h2 className="text-lg font-semibold text-forest-900">Supervisor comment</h2>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-forest-900/80">
            {record.comment?.trim() || 'No comment was provided.'}
          </p>
        </Card>

        <Card muted>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Submitted work
          </h2>
          {approved ? (
            <div className="mt-3">
              <p className="text-sm font-semibold text-forest-900">
                Version {approved.version}
              </p>
              <p className="mt-1 truncate text-xs text-muted">{approved.original_filename}</p>
              <p className="mt-2 text-xs text-success">
                Approved {formatDateTime(approved.reviewed_at ?? approved.created_at)}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">No approved submission recorded.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
