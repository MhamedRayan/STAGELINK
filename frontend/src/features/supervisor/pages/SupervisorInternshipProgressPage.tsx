import { Link, useParams } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import {
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  StatusPill,
  Stepper,
  useToast,
} from '@/components/ui';
import { useCompanyLabel } from '@/features/directory/companies';
import { useOfferTitle } from '@/features/directory/offers';
import { useDemoDirectoryUser, useUserLabel } from '@/features/directory/users';
import { normalizeError } from '@/lib/errors';
import { formatDate, formatDateTime } from '@/lib/format';
import { getStatusInfo } from '@/lib/status';
import { useCompleteInternship, useInternship, useStartInternship, useSubmissions } from '../hooks';
import { S } from '../strings';

/** Supervisor Internship Progress — Figma 27:534. Related files = submission versions (Δ). */
export function SupervisorInternshipProgressPage() {
  const { internshipId } = useParams();
  const toast = useToast();
  const internship = useInternship(internshipId);
  const submissions = useSubmissions(internshipId);
  const start = useStartInternship();
  const complete = useCompleteInternship();
  const offerTitle = useOfferTitle(internship.data?.offer_id);
  const companyName = useCompanyLabel(internship.data?.company_user_id);
  const studentName = useUserLabel(internship.data?.student_user_id, 'student');
  const studentEmail = useDemoDirectoryUser(internship.data?.student_user_id)?.email;
  const companyEmail = useDemoDirectoryUser(internship.data?.company_user_id)?.email;

  if (internship.isError) {
    return <ErrorState error={internship.error} onRetry={() => void internship.refetch()} />;
  }
  if (internship.isLoading) {
    return <Skeleton className="h-[560px] rounded-panel" />;
  }
  if (!internship.data) {
    return (
      <div className="max-w-content">
        <PageHeader title={S.progress.notFound} />
        <EmptyState
          title={S.progress.notFound}
          action={
            <Link
              to={ROUTES.supervisor.students}
              className="mt-2 text-[13px] font-medium text-surface-600 hover:underline"
            >
              ← {S.progress.backStudents}
            </Link>
          }
        />
      </div>
    );
  }

  const data = internship.data;
  const activeIndex = data.status === 'confirmed' ? 0 : data.status === 'in_progress' ? 1 : 2;
  const files = submissions.data ?? [];

  const run = async (action: 'start' | 'complete') => {
    try {
      if (action === 'start') await start.mutateAsync(data.id);
      else await complete.mutateAsync(data.id);
      toast.success(action === 'start' ? S.progress.started : S.progress.completed);
    } catch (error) {
      toast.error(normalizeError(error).message);
    }
  };

  return (
    <div className="max-w-content">
      <Link
        to={ROUTES.supervisor.studentProfile(data.id)}
        className="text-[13px] font-medium text-surface-600 hover:underline"
      >
        ← {S.common.backProfile}
      </Link>

      <div className="mt-3">
        <PageHeader
          title={S.progress.title}
          subtitle={`${offerTitle} · ${companyName}`}
          action={<StatusPill domain="internship" value={data.status} />}
        />
      </div>
      <p className="mt-2 text-[13px] text-ink">
        {S.progress.student}: <span className="font-medium text-forest-900">{studentName}</span> •{' '}
        {S.progress.host}: <span className="font-medium text-forest-900">{companyName}</span>
      </p>
      {(studentEmail || companyEmail) && (
        <p className="mt-1 text-[12px] text-muted">
          {studentEmail && `${S.profile.studentContact}: ${studentEmail}`}
          {studentEmail && companyEmail && ' · '}
          {companyEmail && `${S.profile.companyContact}: ${companyEmail}`}
        </p>
      )}

      <section className="mt-6 rounded-panel border border-line bg-mint p-5">
        <Stepper steps={[...S.progress.steps]} activeIndex={activeIndex} />
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <p className="text-[13px] text-muted">
            {S.progress.currentState}:{' '}
            <span className="font-semibold text-forest-900">
              {getStatusInfo('internship', data.status).label.toUpperCase()}
            </span>
          </p>
          <p className="text-[13px] text-muted">
            {S.common.period}: {formatDate(data.start_date)} → {formatDate(data.end_date)}
          </p>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          {data.status === 'confirmed' && (
            <Button onClick={() => void run('start')} isLoading={start.isPending}>
              {S.progress.start}
            </Button>
          )}
          {data.status === 'in_progress' && (
            <Button onClick={() => void run('complete')} isLoading={complete.isPending}>
              {S.progress.complete}
            </Button>
          )}
          <Link
            to={ROUTES.supervisor.finalReview(data.id)}
            className="inline-flex h-9 items-center text-[13px] font-medium text-surface-600 hover:underline"
          >
            {S.progress.review} →
          </Link>
        </div>
      </section>

      <section className="mt-5 rounded-panel border border-line bg-mint p-5">
        <h2 className="text-[16px] font-semibold text-forest-900">{S.progress.relatedFiles}</h2>
        {submissions.isError ? (
          <div className="mt-4">
            <ErrorState error={submissions.error} onRetry={() => void submissions.refetch()} />
          </div>
        ) : submissions.isLoading ? (
          <Skeleton className="mt-4 h-[140px]" />
        ) : files.length === 0 ? (
          <p className="mt-4 text-[13px] text-muted">{S.progress.noFiles}</p>
        ) : (
          <ul className="mt-4 divide-y divide-line/70">
            {[...files].reverse().map((file) => (
              <li key={file.id} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="text-[13px] font-medium text-forest-900">
                    {S.profile.version} {file.version} · {file.original_filename}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">{formatDateTime(file.created_at)}</p>
                </div>
                <StatusPill domain="submission" value={file.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
