import {
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  StatusPill,
} from '@/components/ui';
import { useUserLabel } from '@/features/directory/users';
import { formatDateTime, formatGrade } from '@/lib/format';
import { useEvaluation, useMyInternships, useSubmissions } from '../hooks';
import { S } from '../strings';

/** Student Evaluation — Figma 25:1472. Grade is a decimal string from the API. */
export function StudentEvaluationPage() {
  const internships = useMyInternships();
  const internship = internships.data?.items[0];
  const evaluation = useEvaluation(internship?.id);
  const submissions = useSubmissions(internship?.id);
  const supervisorName = useUserLabel(evaluation.data?.supervisor_user_id, 'supervisor');

  if (internships.isError) {
    return <ErrorState error={internships.error} onRetry={() => void internships.refetch()} />;
  }
  if (internships.isError || evaluation.isError) {
    return (
      <ErrorState
        error={internships.error ?? evaluation.error}
        onRetry={() => {
          void internships.refetch();
          void evaluation.refetch();
        }}
      />
    );
  }
  if (internships.isLoading || (internship && evaluation.isLoading)) {
    return <Skeleton className="h-[520px] rounded-panel" />;
  }
  if (!internship || !evaluation.data) {
    return (
      <div className="max-w-content">
        <PageHeader title={S.evaluation.title} subtitle={S.evaluation.subtitle} />
        <EmptyState
          title={S.evaluation.notAvailable}
          message={S.evaluation.notAvailableBody}
        />
      </div>
    );
  }

  const data = evaluation.data;
  const approved = submissions.data?.find((item) => item.status === 'APPROVED');

  return (
    <div className="max-w-content">
      <PageHeader title={S.evaluation.title} subtitle={S.evaluation.subtitle} />

      <section className="mt-[26px] rounded-panel bg-mint p-5">
        <StatusPill domain="internship" value="completed" />
        <p className="mt-5 text-[16px] font-semibold text-forest-900">
          {S.evaluation.finalGrade} {formatGrade(data.grade)} {S.evaluation.outOf}
        </p>
        <p className="mt-2 text-[13px] text-muted">
          {S.evaluation.recordedBy} <span className="font-medium text-forest-900">{supervisorName}</span>{' '}
          {S.evaluation.on} {formatDateTime(data.created_at)}
        </p>
      </section>

      <section className="mt-5 rounded-panel bg-mint p-5">
        <h2 className="text-[16px] font-semibold leading-5 text-forest-900">{S.evaluation.remarks}</h2>
        <p className="mt-3 whitespace-pre-wrap text-[13px] leading-5 text-ink">
          {data.comment?.trim() || S.evaluation.noComment}
        </p>
      </section>

      {approved && (
        <section className="mt-5 rounded-panel bg-mint p-5">
          <h2 className="text-[16px] font-semibold leading-5 text-forest-900">
            {S.evaluation.submittedWork}
          </h2>
          <p className="mt-3 text-[13px] text-ink">{approved.original_filename}</p>
          <p className="mt-1 text-[12px] text-muted">
            {S.evaluation.approvedOn} {formatDateTime(approved.reviewed_at)}
          </p>
        </section>
      )}
    </div>
  );
}
