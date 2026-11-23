import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import {
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  StatusPill,
  Tabs,
  Timeline,
  useToast,
} from '@/components/ui';
import { useCompanyLabel } from '@/features/directory/companies';
import { useOfferTitle } from '@/features/directory/offers';
import { useDirectoryUser, useUserLabel } from '@/features/directory/users';
import { normalizeError } from '@/lib/errors';
import { formatBytes, formatDate, formatDateTime, formatGrade } from '@/lib/format';
import { getStatusInfo } from '@/lib/status';
import { shortId } from '@/lib/ids';
import {
  useDownloadSubmission,
  useEvaluation,
  useInternship,
  useInternshipHistory,
  useSubmissions,
} from '../hooks';
import { S } from '../strings';

/** Supervisor Student Profile — Figma 27:357. Files/Reports merged into Submissions (Δ). */
export function SupervisorStudentProfilePage() {
  const { internshipId } = useParams();
  const toast = useToast();
  const [tab, setTab] = useState('overview');
  const internship = useInternship(internshipId);
  const submissions = useSubmissions(internshipId);
  const evaluation = useEvaluation(internshipId);
  const history = useInternshipHistory(internshipId);
  const download = useDownloadSubmission();
  const offerTitle = useOfferTitle(internship.data?.offer_id);
  const companyName = useCompanyLabel(internship.data?.company_user_id);
  const studentName = useUserLabel(internship.data?.student_user_id, 'student');
  const student = useDirectoryUser(internship.data?.student_user_id);
  const matricule = student?.matricule;

  if (internship.isError) {
    return <ErrorState error={internship.error} onRetry={() => void internship.refetch()} />;
  }
  if (internship.isLoading) {
    return <Skeleton className="h-[640px] rounded-panel" />;
  }
  if (!internship.data) {
    return (
      <div className="max-w-content">
        <PageHeader title={S.profile.notFound} />
        <EmptyState
          title={S.profile.notFound}
          action={
            <Link
              to={ROUTES.supervisor.students}
              className="mt-2 text-[13px] font-medium text-surface-600 hover:underline"
            >
              ← {S.common.backStudents}
            </Link>
          }
        />
      </div>
    );
  }

  const data = internship.data;
  const files = submissions.data ?? [];
  const grade = evaluation.data;

  const onDownload = async (submissionId: string, filename: string) => {
    try {
      await download.mutateAsync({ internshipId: data.id, submissionId, filename });
    } catch (error) {
      toast.error(normalizeError(error).message);
    }
  };

  return (
    <div className="max-w-content">
      <Link
        to={ROUTES.supervisor.students}
        className="text-[13px] font-medium text-surface-600 hover:underline"
      >
        ← {S.common.backStudents}
      </Link>

      <div className="mt-3">
        <PageHeader
          title={studentName}
          subtitle={`${S.profile.assigned} • ${offerTitle} ${S.profile.headerMeta} ${companyName}`}
          action={<StatusPill domain="internship" value={data.status} />}
        />
      </div>
      <p className="mt-2 text-[12px] text-muted">
        {S.profile.id}: {matricule ?? shortId(data.student_user_id)}
        {student?.email ? ` · ${S.profile.email}: ${student.email}` : ''}
      </p>

      <div className="mt-6">
        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { id: 'overview', label: S.profile.overview },
            { id: 'internship', label: S.profile.internship },
            { id: 'submissions', label: `${S.profile.submissions} (${files.length})` },
            ...(grade ? [{ id: 'evaluation', label: S.profile.evaluation }] : []),
            { id: 'history', label: S.profile.history },
          ]}
        />
      </div>

      {tab === 'overview' && (
        <div className="mt-5 grid grid-cols-2 gap-[42px]">
          <section className="rounded-panel border border-line bg-mint p-5">
            <h2 className="text-[16px] font-semibold text-forest-900">{S.profile.placementTitle}</h2>
            <dl className="mt-4 space-y-3 text-[13px]">
              <div className="flex gap-3">
                <dt className="w-[130px] text-muted">{S.profile.period}</dt>
                <dd>{formatDate(data.start_date)} → {formatDate(data.end_date)}</dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-[130px] text-muted">{S.profile.host}</dt>
                <dd>{companyName}</dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-[130px] text-muted">{S.profile.role}</dt>
                <dd>{offerTitle}</dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-[130px] text-muted">{S.profile.assignedOn}</dt>
                <dd>{formatDate(data.created_at)}</dd>
              </div>
            </dl>
          </section>
          <section className="rounded-panel border border-line bg-mint p-5">
            <h2 className="text-[16px] font-semibold text-forest-900">{S.profile.actionsTitle}</h2>
            <p className="mt-3 text-[13px] leading-5 text-ink">{S.profile.actionsBody}</p>
            <Link
              to={ROUTES.supervisor.finalReview(data.id)}
              className="mt-4 inline-block text-[13px] font-medium text-surface-600 hover:underline"
            >
              {S.profile.openReview} →
            </Link>
          </section>
        </div>
      )}

      {tab === 'internship' && (
        <section className="mt-5 rounded-panel border border-line bg-mint p-5">
          <h2 className="text-[16px] font-semibold text-forest-900">{S.profile.internship}</h2>
          <dl className="mt-4 space-y-3 text-[13px]">
            <div className="flex gap-3">
              <dt className="w-[130px] text-muted">{S.profile.period}</dt>
              <dd>{formatDate(data.start_date)} → {formatDate(data.end_date)}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-[130px] text-muted">{S.profile.host}</dt>
              <dd>{companyName}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-[130px] text-muted">{S.common.status}</dt>
              <dd><StatusPill domain="internship" value={data.status} /></dd>
            </div>
          </dl>
          <Link
            to={ROUTES.supervisor.internshipProgress(data.id)}
            className="mt-4 inline-block text-[13px] font-medium text-surface-600 hover:underline"
          >
            {S.profile.openProgress} →
          </Link>
          <div className="mt-6 grid grid-cols-2 gap-[42px]">
            <div>
              <h3 className="text-[13px] font-semibold text-forest-900">{S.profile.studentContact}</h3>
              <p className="mt-2 text-[13px] text-ink">{studentName}</p>
              {student?.email && <p className="mt-1 text-[12px] text-muted">{student.email}</p>}
            </div>
            <div>
              <h3 className="text-[13px] font-semibold text-forest-900">{S.profile.companyContact}</h3>
              <p className="mt-2 text-[13px] text-ink">{companyName}</p>
            </div>
          </div>
        </section>
      )}

      {tab === 'submissions' && (
        <section className="mt-5 rounded-panel border border-line bg-mint p-5">
          <h2 className="text-[16px] font-semibold text-forest-900">{S.profile.submissionsTitle}</h2>
          {submissions.isError ? (
            <div className="mt-4">
              <ErrorState error={submissions.error} onRetry={() => void submissions.refetch()} />
            </div>
          ) : submissions.isLoading ? (
            <Skeleton className="mt-4 h-[240px]" />
          ) : files.length === 0 ? (
            <p className="mt-4 text-[13px] text-muted">{S.profile.noSubmissions}</p>
          ) : (
            <ul className="mt-4 divide-y divide-line/70">
              {[...files].reverse().map((file) => (
                <li key={file.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-forest-900">
                      {S.profile.version} {file.version} · {file.original_filename}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {S.profile.uploadedOn} {formatDateTime(file.created_at)} ·{' '}
                      {formatBytes(file.size_bytes)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <StatusPill domain="submission" value={file.status} />
                    <Button
                      variant="link"
                      onClick={() => void onDownload(file.id, file.original_filename)}
                    >
                      {S.common.download}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'evaluation' && grade && (
        <section className="mt-5 rounded-panel border border-line bg-mint p-5">
          <h2 className="text-[16px] font-semibold text-forest-900">{S.profile.evaluationTitle}</h2>
          <p className="mt-4 text-[16px] font-semibold text-forest-900">
            {S.profile.finalScore}: {formatGrade(grade.grade)} / 20
          </p>
          <p className="mt-3 whitespace-pre-wrap text-[13px] leading-5 text-ink">
            {grade.comment?.trim() || S.profile.noEvaluation}
          </p>
        </section>
      )}

      {tab === 'history' && (
        <section className="mt-5 rounded-panel border border-line bg-mint p-5">
          <h2 className="text-[16px] font-semibold text-forest-900">{S.profile.historyTitle}</h2>
          <div className="mt-4">
            {history.isError ? (
              <ErrorState error={history.error} onRetry={() => void history.refetch()} />
            ) : history.isLoading ? (
              <Skeleton className="h-[180px]" />
            ) : (history.data?.length ?? 0) === 0 ? (
              <p className="text-[13px] text-muted">{S.profile.noHistory}</p>
            ) : (
              <Timeline
                items={(history.data ?? []).map((item) => ({
                  id: item.id,
                  title: item.to_status
                    ? getStatusInfo('internship', item.to_status).label
                    : S.profile.statusChanged,
                  meta: formatDateTime(item.at),
                  body: item.reason?.trim() || undefined,
                }))}
              />
            )}
          </div>
        </section>
      )}
    </div>
  );
}
