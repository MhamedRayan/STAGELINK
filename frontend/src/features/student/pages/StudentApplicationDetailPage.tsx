import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import {
  Button,
  ErrorState,
  ReasonDialog,
  Skeleton,
  StatusPill,
  Timeline,
  useToast,
} from '@/components/ui';
import { useCompanyLabel } from '@/features/directory/companies';
import { useOfferTitle } from '@/features/directory/offers';
import { formatDate, formatDateTime } from '@/lib/format';
import { normalizeError } from '@/lib/errors';
import { getStatusInfo } from '@/lib/status';
import {
  useApplication,
  useApplicationHistory,
  useStudentDecision,
  useWithdrawApplication,
} from '../hooks';
import { S } from '../strings';

function DecisionBlock({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <section className="rounded-panel bg-mint p-5">
      <h2 className="text-[16px] font-semibold leading-5 text-forest-900">{title}</h2>
      <p className="mt-2 text-[13px] leading-5 text-ink">{body}</p>
      {children && <div className="mt-4 flex flex-wrap gap-3">{children}</div>}
    </section>
  );
}

/** Student Application Detail — Figma 25:704 / 25:858 / 25:1004. */
export function StudentApplicationDetailPage() {
  const { applicationId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const application = useApplication(applicationId);
  const history = useApplicationHistory(applicationId);
  const decision = useStudentDecision();
  const withdraw = useWithdrawApplication();
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  if (application.isError) {
    return <ErrorState error={application.error} onRetry={() => void application.refetch()} />;
  }
  if (application.isLoading || !application.data) {
    return <Skeleton className="h-[600px] rounded-panel" />;
  }

  const data = application.data;
  const offerTitle = <OfferLabel offerId={data.offer_id} />;
  const company = <CompanyLabel companyId={data.company_user_id} />;

  const handleDecision = async (value: 'ACCEPT' | 'DECLINE') => {
    try {
      await decision.mutateAsync({ id: data.id, decision: value });
      toast.success(value === 'ACCEPT' ? S.applicationDetail.decisionAccepted : S.applicationDetail.decisionDeclined);
      if (value === 'DECLINE') navigate(ROUTES.student.applications);
    } catch (error) {
      toast.error(normalizeError(error).message);
    }
  };

  const handleWithdraw = async (reason: string) => {
    await withdraw.mutateAsync({ id: data.id, reason });
    toast.success(S.applicationDetail.withdrawn);
    navigate(ROUTES.student.applications);
  };

  const timeline = (history.data ?? []).map((entry) => ({
    id: entry.id,
    title: entry.from_status
      ? `${getStatusInfo('application', entry.from_status).label} → ${getStatusInfo('application', entry.to_status).label}`
      : getStatusInfo('application', entry.to_status).label,
    meta: formatDateTime(entry.created_at),
    body: entry.reason ?? undefined,
  }));

  return (
    <div className="max-w-content">
      <Link to={ROUTES.student.applications} className="text-[13px] text-muted hover:underline">
        {S.applicationDetail.back}
      </Link>

      <header className="mt-[24px] flex items-start justify-between gap-6">
        <div>
          <h1 className="text-page-title text-forest-900">{offerTitle} · {company}</h1>
          <p className="mt-1 text-body text-muted">
            {S.applicationDetail.appliedOn} {formatDate(data.created_at)} · {formatDate(data.start_date)} —{' '}
            {formatDate(data.end_date)}
          </p>
        </div>
        <StatusPill domain="application" value={data.status} />
      </header>

      <section className="mt-[26px] rounded-panel bg-mint p-5">
        <h2 className="text-[16px] font-semibold leading-5 text-forest-900">{S.applicationDetail.history}</h2>
        <div className="mt-5">
          {history.isLoading ? (
            <Skeleton className="h-20" />
          ) : history.data?.length ? (
            <Timeline items={timeline} />
          ) : (
            <p className="text-[13px] text-muted">{S.applicationDetail.historyEmpty}</p>
          )}
        </div>
      </section>

      <div className="mt-[20px]">
        {data.status === 'UNIVERSITY_VALIDATED' && (
          <DecisionBlock title={S.applicationDetail.awaitingTitle} body={S.applicationDetail.awaitingBody}>
            <Button onClick={() => void handleDecision('ACCEPT')} isLoading={decision.isPending}>
              {S.applicationDetail.accept}
            </Button>
            <Button
              variant="secondary"
              onClick={() => void handleDecision('DECLINE')}
              disabled={decision.isPending}
            >
              {S.applicationDetail.decline}
            </Button>
          </DecisionBlock>
        )}
        {data.status === 'COMPANY_ACCEPTED' && (
          <DecisionBlock
            title={S.applicationDetail.companyAcceptedTitle}
            body={S.applicationDetail.companyAcceptedBody}
          />
        )}
        {data.status === 'CONFIRMED' && (
          <DecisionBlock title={S.applicationDetail.confirmedTitle} body={S.applicationDetail.confirmedBody}>
            <Button onClick={() => navigate(ROUTES.student.internship)}>
              {S.applicationDetail.goInternship}
            </Button>
          </DecisionBlock>
        )}
        {data.status === 'COMPANY_REJECTED' && (
          <DecisionBlock
            title={S.applicationDetail.rejectedByCompany}
            body={`${S.applicationDetail.rejectedByCompanyBody} ${S.applicationDetail.feedback} ${data.company_reason ?? '—'}`}
          />
        )}
        {data.status === 'UNIVERSITY_REJECTED' && (
          <DecisionBlock
            title={S.applicationDetail.rejectedByUniversity}
            body={`${S.applicationDetail.rejectedByUniversityBody} ${S.applicationDetail.reason} ${data.university_reason ?? '—'}`}
          />
        )}
        {data.status === 'STUDENT_DECLINED' && (
          <DecisionBlock
            title={S.applicationDetail.closed}
            body={`${S.applicationDetail.decisionDeclined} ${data.student_decision ?? ''}`}
          />
        )}
        {data.status === 'WITHDRAWN' && (
          <DecisionBlock
            title={S.applicationDetail.withdrawn}
            body={`${S.applicationDetail.withdrawnBody} ${formatDate(data.withdrawn_at)}. ${data.withdrawal_reason ?? ''}`}
          />
        )}
        {data.status === 'SUBMITTED' && (
          <DecisionBlock title={S.applicationDetail.submittedTitle} body={S.applicationDetail.submittedBody} />
        )}
        {data.status === 'STUDENT_ACCEPTED' && (
          <DecisionBlock
            title={S.applicationDetail.studentAcceptedTitle}
            body={S.applicationDetail.studentAcceptedBody}
          />
        )}
      </div>

      {['SUBMITTED', 'COMPANY_ACCEPTED', 'UNIVERSITY_VALIDATED', 'STUDENT_ACCEPTED'].includes(
        data.status,
      ) && (
        <div className="mt-5">
          <Button variant="secondary" onClick={() => setWithdrawOpen(true)}>
            {S.applicationDetail.withdraw}
          </Button>
        </div>
      )}

      <ReasonDialog
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        title={S.applicationDetail.withdrawTitle}
        label={S.applicationDetail.withdrawReason}
        confirmLabel={S.applicationDetail.confirmWithdraw}
        onConfirm={handleWithdraw}
      />
    </div>
  );
}

function OfferLabel({ offerId }: { offerId: string }) {
  return <>{useOfferTitle(offerId)}</>;
}

function CompanyLabel({ companyId }: { companyId: string }) {
  return <>{useCompanyLabel(companyId)}</>;
}
