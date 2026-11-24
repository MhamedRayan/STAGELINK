import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import {
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  ReasonDialog,
  Skeleton,
  StatusPill,
  Timeline,
  useToast,
} from '@/components/ui';
import { useCompanyLabel } from '@/features/directory/companies';
import { useOfferSummary } from '@/features/directory/offers';
import { useUserLabel } from '@/features/directory/users';
import { normalizeError } from '@/lib/errors';
import { formatDate, formatDateTime } from '@/lib/format';
import { getStatusInfo } from '@/lib/status';
import { shortId } from '@/lib/ids';
import { useUniversityApplication, useUniversityApplicationHistory, useUniversityDecision } from '../hooks';
import { S } from '../strings';

/** University Application Detail — Figma 28:717. */
export function UniversityApplicationDetailPage() {
  const { applicationId } = useParams();
  const toast = useToast();
  const application = useUniversityApplication(applicationId);
  const history = useUniversityApplicationHistory(applicationId);
  const decision = useUniversityDecision();
  const offer = useOfferSummary(application.data?.offer_id);
  const companyName = useCompanyLabel(application.data?.company_user_id);
  const studentName = useUserLabel(application.data?.student_user_id, 'student');

  if (application.isError) {
    return <ErrorState error={application.error} onRetry={() => void application.refetch()} />;
  }
  if (application.isLoading) {
    return <Skeleton className="h-[620px] rounded-panel" />;
  }
  if (!application.data) {
    return (
      <div className="max-w-content">
        <PageHeader title={S.detail.title} />
        <EmptyState
          title={S.detail.notFound}
          action={
            <Link
              to={ROUTES.university.applications}
              className="mt-2 text-[13px] font-medium text-surface-600 hover:underline"
            >
              ← {S.detail.back}
            </Link>
          }
        />
      </div>
    );
  }

  const data = application.data;
  const offerData = offer.data;
  const pending = data.status === 'COMPANY_ACCEPTED';

  const validate = async () => {
    try {
      await decision.mutateAsync({ id: data.id, decision: 'ACCEPT' });
      toast.success(S.detail.validated);
    } catch (error) {
      toast.error(normalizeError(error).message);
    }
  };

  const reject = async (reason: string) => {
    await decision.mutateAsync({ id: data.id, decision: 'REJECT', reason });
    toast.success(S.detail.rejected);
  };

  return (
    <div className="max-w-content">
      <PageHeader
        title={S.detail.title}
        subtitle={`${studentName} · ${companyName}`}
        action={<StatusPill domain="application" value={data.status} />}
      />

      <Link
        to={ROUTES.university.applications}
        className="mt-3 inline-block text-[13px] font-medium text-surface-600 hover:underline"
      >
        ← {S.detail.back}
      </Link>

      {pending && (
        <section className="mt-5 rounded-panel border border-line bg-mint p-5">
          <h2 className="text-[16px] font-semibold text-forest-900">{S.detail.decisionTitle}</h2>
          <p className="mt-2 max-w-[820px] text-[13px] leading-5 text-ink">{S.detail.decisionBody}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={() => void validate()} isLoading={decision.isPending}>
              {S.detail.validate}
            </Button>
            <ReasonDialogButton onReject={reject} isPending={decision.isPending} />
          </div>
        </section>
      )}

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-[42px]">
        <section className="rounded-panel border border-line bg-mint p-5">
          <h2 className="text-[16px] font-semibold text-forest-900">{S.detail.studentBlock}</h2>
          <dl className="mt-4 space-y-3 text-[13px]">
            <div className="flex gap-3">
              <dt className="w-[110px] shrink-0 text-muted sm:w-[130px]">{S.common.student}</dt>
              <dd className="font-medium text-forest-900">{studentName}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-[110px] shrink-0 text-muted sm:w-[130px]">{S.detail.id}</dt>
              <dd className="text-forest-900">{shortId(data.student_user_id)}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-[110px] shrink-0 text-muted sm:w-[130px]">{S.detail.proposedPeriod}</dt>
              <dd className="text-forest-900">
                {formatDate(data.start_date)} → {formatDate(data.end_date)}
              </dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-[110px] shrink-0 text-muted sm:w-[130px]">{S.detail.appliedOn}</dt>
              <dd className="text-forest-900">{formatDate(data.created_at)}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-panel border border-line bg-mint p-5">
          <h2 className="text-[16px] font-semibold text-forest-900">{S.detail.offerBlock}</h2>
          <p className="mt-4 text-[14px] font-semibold text-forest-900">
            {offerData?.title ?? `Offer · ${shortId(data.offer_id)}`}
          </p>
          <dl className="mt-3 space-y-3 text-[13px]">
            <div className="flex gap-3">
              <dt className="w-[110px] shrink-0 text-muted sm:w-[130px]">{S.common.company}</dt>
              <dd className="text-forest-900">{companyName}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-[110px] shrink-0 text-muted sm:w-[130px]">{S.detail.location}</dt>
              <dd className="text-forest-900">{offerData?.location?.trim() || S.common.notProvided}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-[110px] shrink-0 text-muted sm:w-[130px]">{S.detail.places}</dt>
              <dd className="text-forest-900">{offerData?.capacity ?? '—'}</dd>
            </div>
          </dl>
          <p className="mt-4 text-[13px] leading-5 text-ink">
            {offerData?.description?.trim() || S.detail.noDescription}
          </p>
        </section>
      </div>

      <section className="mt-5 rounded-panel border border-line bg-mint p-5">
        <h2 className="text-[16px] font-semibold text-forest-900">{S.detail.historyBlock}</h2>
        <div className="mt-4">
          {history.isError ? (
            <ErrorState error={history.error} onRetry={() => void history.refetch()} />
          ) : history.isLoading ? (
            <Skeleton className="h-[160px]" />
          ) : (history.data?.length ?? 0) === 0 ? (
            <p className="text-[13px] text-muted">{S.detail.historyEmpty}</p>
          ) : (
            <Timeline
              items={(history.data ?? []).map((item) => ({
                id: item.id,
                title: getStatusInfo('application', item.to_status).label,
                meta: formatDateTime(item.created_at),
                body: item.reason?.trim() || undefined,
              }))}
            />
          )}
        </div>
      </section>
    </div>
  );
}

/** Keeps the reason dialog state local to the detail page. */
function ReasonDialogButton({
  onReject,
  isPending,
}: {
  onReject(reason: string): Promise<void>;
  isPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)} disabled={isPending}>
        {S.detail.reject}
      </Button>
      <ReasonDialog
        open={open}
        onClose={() => setOpen(false)}
        title={S.detail.rejectTitle}
        label={S.detail.rejectReason}
        description={S.detail.rejectBody}
        confirmLabel={S.detail.rejectConfirm}
        required
        onConfirm={onReject}
      />
    </>
  );
}
