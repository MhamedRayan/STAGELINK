import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import {
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  ReasonDialog,
  Skeleton,
  StatusPill,
  Stepper,
  useToast,
} from '@/components/ui';
import { useCompanyLabel, useCompanyProfile } from '@/features/directory/companies';
import { useOfferTitle } from '@/features/directory/offers';
import { useUserLabel } from '@/features/directory/users';
import { formatDate, formatDateTime } from '@/lib/format';
import { normalizeError } from '@/lib/errors';
import {
  useCancellationRequests,
  useMyInternships,
  useRequestCancellation,
} from '../hooks';
import { S } from '../strings';

const STEP_INDEX: Record<string, number> = {
  confirmed: 0,
  in_progress: 1,
  completed: 2,
};

/** Student My Internship — Figma 25:1151. */
export function StudentInternshipPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const internships = useMyInternships();
  const internship = internships.data?.items[0];
  const offerTitle = useOfferTitle(internship?.offer_id);
  const companyName = useCompanyLabel(internship?.company_user_id);
  const supervisorName = useUserLabel(internship?.supervisor_user_id ?? undefined, 'supervisor');
  const requests = useCancellationRequests(internship?.id);
  const companyProfile = useCompanyProfile(internship?.company_user_id);
  const requestCancellation = useRequestCancellation();
  const [cancelOpen, setCancelOpen] = useState(false);

  if (internships.isError) {
    return <ErrorState error={internships.error} onRetry={() => void internships.refetch()} />;
  }
  if (internships.isLoading) {
    return <Skeleton className="h-[600px] rounded-panel" />;
  }
  if (!internship) {
    return (
      <div className="max-w-content">
        <PageHeader title={S.internship.noTitle} />
        <EmptyState
          title={S.internship.noTitle}
          message={S.internship.noBody}
          action={
            <Link
              to={ROUTES.student.offers}
              className="mt-2 text-[13px] font-medium text-surface-600 hover:underline"
            >
              {S.internship.browse}
            </Link>
          }
        />
      </div>
    );
  }

  const pending = requests.data?.find((item) => item.status === 'pending');
  const activeIndex = STEP_INDEX[internship.status] ?? 0;

  const submitCancellation = async (reason: string) => {
    try {
      await requestCancellation.mutateAsync({ internshipId: internship.id, reason });
      toast.success(S.internship.cancellationSubmitted);
      setCancelOpen(false);
    } catch (error) {
      toast.error(normalizeError(error).message);
      throw error;
    }
  };

  return (
    <div className="max-w-content">
      <PageHeader
        title={offerTitle}
        subtitle={`${S.internship.period}: ${formatDate(internship.start_date)} — ${formatDate(internship.end_date)}`}
        action={<StatusPill domain="internship" value={internship.status} />}
      />

      <section className="mt-[26px] rounded-panel bg-mint p-5">
        <div className="flex items-center gap-2 text-[14px] text-forest-900">
          <span>{companyName}</span>
          <span className="text-muted">•</span>
          <span>{companyProfile.data?.address?.trim() || S.offerDetail.notProvided}</span>
        </div>
        <div className="mt-8">
          <Stepper steps={[...S.internship.steps]} activeIndex={activeIndex} />
        </div>
        {internship.status === 'cancelled' && (
          <p className="mt-6 text-[13px] text-pill-danger-fg">{S.internship.cancelled}</p>
        )}
      </section>

      <section className="mt-5 rounded-panel bg-mint p-5">
        <h2 className="text-[16px] font-semibold leading-5 text-forest-900">
          {S.internship.supervisor}
        </h2>
        <p className="mt-3 text-[13px] text-ink">{S.internship.supervisorBody}</p>
        {internship.supervisor_user_id ? (
          <dl className="mt-4 space-y-2 text-[13px]">
            <div className="flex gap-3">
              <dt className="w-20 text-muted">{S.internship.name}</dt>
              <dd className="font-medium text-forest-900">{supervisorName}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-20 text-muted">{S.internship.email}</dt>
              <dd className="text-forest-900">{S.internship.notProvided}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-20 text-muted">{S.internship.phone}</dt>
              <dd className="text-forest-900">{S.internship.notProvided}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-3 text-[13px] text-muted">{S.internship.supervisorPending}</p>
        )}
      </section>

      <section className="mt-5 rounded-panel bg-mint p-5">
        <h2 className="text-[16px] font-semibold leading-5 text-forest-900">
          {S.internship.deliverables}
        </h2>
        <div className="mt-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-[13px] font-medium text-forest-900">{S.internship.finalReport}</p>
            <p className="mt-0.5 text-[11px] text-muted">
              {formatDate(internship.start_date)} — {formatDate(internship.end_date)}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate(ROUTES.student.evaluation)}>
              {S.internship.viewGrade}
            </Button>
            <Button onClick={() => navigate(ROUTES.student.submission)}>
              {S.internship.uploadReport}
            </Button>
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-panel bg-mint p-5">
        <h2 className="text-[16px] font-semibold leading-5 text-forest-900">
          {S.internship.cancellation}
        </h2>
        <p className="mt-2 text-[13px] leading-5 text-ink">{S.internship.cancellationBody}</p>
        <div className="mt-4">
          {pending ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <StatusPill domain="cancellation" value={pending.status} />
                <span className="text-[12px] text-muted">{formatDateTime(pending.created_at)}</span>
              </div>
              <p className="text-[13px] text-ink">
                {S.internship.reasonSubmitted} {pending.reason}
              </p>
              <p className="text-[12px] text-muted">{S.internship.reviewing}</p>
            </div>
          ) : requests.isError ? (
            <ErrorState error={requests.error} onRetry={() => void requests.refetch()} />
          ) : requests.isLoading ? (
            <Skeleton className="h-12" />
          ) : ['confirmed', 'in_progress'].includes(internship.status) ? (
            <Button variant="secondary" onClick={() => setCancelOpen(true)}>
              {S.internship.requestCancellation}
            </Button>
          ) : (
            <p className="text-[13px] text-muted">{S.internship.noCancellation}</p>
          )}
        </div>
      </section>

      <ReasonDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title={S.internship.cancelTitle}
        label={S.internship.cancelReason}
        confirmLabel={S.internship.submitCancel}
        required
        onConfirm={submitCancellation}
      />
    </div>
  );
}
