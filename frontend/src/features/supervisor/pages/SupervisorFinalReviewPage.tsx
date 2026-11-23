import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  Input,
  PageHeader,
  ReasonDialog,
  Skeleton,
  StatusPill,
  Textarea,
  useToast,
} from '@/components/ui';
import { useCompanyLabel } from '@/features/directory/companies';
import { useOfferTitle } from '@/features/directory/offers';
import { useUserLabel } from '@/features/directory/users';
import { normalizeError } from '@/lib/errors';
import { formatBytes, formatDateTime, formatGrade } from '@/lib/format';
import type { InternshipSubmission } from '@/api/internships';
import {
  useApproveSubmission,
  useCreateEvaluation,
  useDownloadSubmission,
  useEvaluation,
  useInternship,
  useRejectSubmission,
  useSubmissions,
} from '../hooks';
import { S } from '../strings';

/** Supervisor Final Review & Evaluation — Figma 27:689. */
export function SupervisorFinalReviewPage() {
  const { internshipId } = useParams();
  const toast = useToast();
  const internship = useInternship(internshipId);
  const submissions = useSubmissions(internshipId);
  const evaluation = useEvaluation(internshipId);
  const approve = useApproveSubmission();
  const reject = useRejectSubmission();
  const record = useCreateEvaluation();
  const download = useDownloadSubmission();
  const offerTitle = useOfferTitle(internship.data?.offer_id);
  const companyName = useCompanyLabel(internship.data?.company_user_id);
  const studentName = useUserLabel(internship.data?.student_user_id, 'student');
  const [grade, setGrade] = useState('');
  const [comment, setComment] = useState('');
  const [reasonTarget, setReasonTarget] = useState<InternshipSubmission | null>(null);
  const [approveTarget, setApproveTarget] = useState<InternshipSubmission | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  if (internship.isError) {
    return <ErrorState error={internship.error} onRetry={() => void internship.refetch()} />;
  }
  if (internship.isLoading) {
    return <Skeleton className="h-[640px] rounded-panel" />;
  }
  if (!internship.data) {
    return (
      <div className="max-w-content">
        <PageHeader title={S.review.title} />
        <EmptyState title={S.review.subtitle.replace('{student}', '').replace('{offer}', '')} />
      </div>
    );
  }

  const data = internship.data;
  const files = submissions.data ?? [];
  const recorded = evaluation.data;
  const isApproved = files.some((item) => item.status === 'APPROVED');
  const canRecord = isApproved || Boolean(recorded);
  const currentGrade = grade || recorded?.grade || '';
  const currentComment = comment || recorded?.comment || '';

  const onDownload = async (submissionId: string, filename: string) => {
    try {
      await download.mutateAsync({ internshipId: data.id, submissionId, filename });
    } catch (error) {
      toast.error(normalizeError(error).message);
    }
  };

  const onApprove = async (reason: string) => {
    if (!approveTarget) return;
    await approve.mutateAsync({ internshipId: data.id, submissionId: approveTarget.id, reason });
    toast.success(S.review.approved);
    setApproveTarget(null);
  };

  const onReject = async (reason: string) => {
    if (!reasonTarget) return;
    await reject.mutateAsync({ internshipId: data.id, submissionId: reasonTarget.id, reason });
    toast.success(S.review.resubmitted);
    setReasonTarget(null);
  };

  const onRecord = async () => {
    const raw = currentGrade.trim();
    const value = Number.parseFloat(raw);
    if (!/^\d{1,2}(\.\d{1,2})?$/.test(raw) || !Number.isFinite(value) || value < 0 || value > 20) {
      setFormError(S.review.gradeError);
      return;
    }
    setFormError(null);
    try {
      await record.mutateAsync({
        internshipId: data.id,
        grade: value.toFixed(2),
        comment: currentComment.trim() || undefined,
      });
      toast.success(S.review.recorded);
    } catch (error) {
      setFormError(normalizeError(error).message);
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
          title={S.review.title}
          subtitle={`${offerTitle} · ${companyName} · ${studentName}`}
          action={<StatusPill domain="internship" value={data.status} />}
        />
      </div>

      <section className="mt-6 rounded-panel border border-line bg-mint p-5">
        <h2 className="text-[16px] font-semibold text-forest-900">{S.review.submittedWork}</h2>
        {submissions.isError ? (
          <div className="mt-4">
            <ErrorState error={submissions.error} onRetry={() => void submissions.refetch()} />
          </div>
        ) : submissions.isLoading ? (
          <Skeleton className="mt-4 h-[200px]" />
        ) : files.length === 0 ? (
          <p className="mt-4 text-[13px] text-muted">{S.review.noSubmissions}</p>
        ) : (
          <ul className="mt-4 divide-y divide-line/70">
            {[...files].reverse().map((file) => (
              <li key={file.id} className="flex flex-wrap items-center gap-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-forest-900">
                    {S.profile.version} {file.version} · {file.original_filename}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {S.review.uploaded}: {formatDateTime(file.created_at)} ·{' '}
                    {formatBytes(file.size_bytes)}
                  </p>
                  {file.review_reason?.trim() && (
                    <p className="mt-1 text-[12px] text-ink">
                      {S.review.feedback}: “{file.review_reason}”
                    </p>
                  )}
                </div>
                <StatusPill domain="submission" value={file.status} />
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="link"
                    onClick={() => void onDownload(file.id, file.original_filename)}
                  >
                    {S.common.download}
                  </Button>
                  {file.status === 'SUBMITTED' && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => setApproveTarget(file)}
                        disabled={approve.isPending}
                      >
                        {S.review.approve}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setReasonTarget(file)}
                        disabled={reject.isPending}
                      >
                        {S.review.resubmit}
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-5 rounded-panel border border-line bg-mint p-5">
        <h2 className="text-[16px] font-semibold text-forest-900">{S.review.evaluationTitle}</h2>
        {evaluation.isError ? (
          <div className="mt-4">
            <ErrorState error={evaluation.error} onRetry={() => void evaluation.refetch()} />
          </div>
        ) : evaluation.isLoading ? (
          <Skeleton className="mt-4 h-[160px]" />
        ) : !canRecord ? (
          <p className="mt-4 text-[13px] text-muted">{S.review.locked}</p>
        ) : (
          <div className="mt-4 max-w-[560px] space-y-4">
            <Field
              label={currentGrade && recorded && !grade ? `${S.review.savedGrade}: ${formatGrade(recorded.grade)} / 20` : S.review.score}
              error={formError ?? undefined}
            >
              <Input
                type="number"
                step="0.25"
                min={0}
                max={20}
                value={currentGrade}
                onChange={(event) => setGrade(event.target.value)}
                placeholder={S.review.scorePlaceholder}
                hasError={Boolean(formError)}
              />
            </Field>
            <Field label={S.review.comment}>
              <Textarea
                rows={4}
                value={currentComment}
                onChange={(event) => setComment(event.target.value)}
                placeholder={S.review.commentPlaceholder}
              />
            </Field>
            <Button onClick={() => void onRecord()} isLoading={record.isPending}>
              {recorded ? S.review.update : S.review.record}
            </Button>
          </div>
        )}
      </section>

      <ReasonDialog
        open={Boolean(approveTarget)}
        onClose={() => setApproveTarget(null)}
        title={S.review.approveTitle}
        label={S.review.approveReason}
        description={S.review.approveBody}
        confirmLabel={S.review.approveConfirm}
        required
        onConfirm={onApprove}
      />
      <ReasonDialog
        open={Boolean(reasonTarget)}
        onClose={() => setReasonTarget(null)}
        title={S.review.rejectTitle.replace('{version}', String(reasonTarget?.version ?? ''))}
        label={S.review.rejectReason}
        description={S.review.rejectBody}
        confirmLabel={S.review.rejectConfirm}
        required
        onConfirm={onReject}
      />
    </div>
  );
}
