import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import {
  Button,
  ErrorState,
  Field,
  Input,
  Modal,
  Skeleton,
  useToast,
} from '@/components/ui';
import { useCompanyProfile } from '@/features/directory/companies';
import { useOffer } from '@/features/offers/hooks';
import { formatDate } from '@/lib/format';
import { normalizeError } from '@/lib/errors';
import { useOfferApplication, useSubmitApplication } from '../hooks';
import { S } from '../strings';

function isoAfter(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-h-[90px]">
      <h2 className="text-[16px] font-semibold leading-[19px] text-forest-900">{title}</h2>
      <div className="mt-[11px] whitespace-pre-wrap text-[13px] leading-4 text-forest-900">
        {children}
      </div>
    </section>
  );
}

/** Student Offer Details — Figma 25:375. Apply modal is a Δ addition (design-plan §3.2). */
export function StudentOfferDetailPage() {
  const { offerId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const offer = useOffer(offerId);
  const company = useCompanyProfile(offer.data?.company_user_id);
  const existing = useOfferApplication(offerId);
  const submit = useSubmitApplication();

  const [applyOpen, setApplyOpen] = useState(false);
  const [startDate, setStartDate] = useState(() => isoAfter(30));
  const [endDate, setEndDate] = useState(() => isoAfter(120));
  const [formError, setFormError] = useState<string | null>(null);

  if (offer.isError) {
    return <ErrorState error={offer.error} onRetry={() => void offer.refetch()} />;
  }
  if (offer.isLoading || !offer.data) {
    return <Skeleton className="h-[420px] w-full rounded-panel sm:h-[700px]" />;
  }

  const data = offer.data;
  const companyName = company.data?.legal_name?.trim() || 'Company';
  const places = data.capacity === 1 ? '1 place' : `${data.capacity} places`;
  const contact = [company.data?.address, company.data?.website]
    .filter((value): value is string => Boolean(value?.trim()))
    .join('   •   ');
  const deadlinePassed = new Date(data.deadline).getTime() < Date.now();
  const notOpen = data.status !== 'published';
  const hasApplied = Boolean(existing.data);
  const canApply = !hasApplied && !deadlinePassed && !notOpen;

  const openApply = () => {
    setStartDate(isoAfter(30));
    setEndDate(isoAfter(120));
    setFormError(null);
    setApplyOpen(true);
  };

  const closeApply = () => {
    if (!submit.isPending) setApplyOpen(false);
  };

  const confirmApply = async () => {
    if (!startDate || !endDate || startDate >= endDate) {
      setFormError(S.offerDetail.dateOrder);
      return;
    }
    setFormError(null);
    try {
      await submit.mutateAsync({ offer_id: data.id, start_date: startDate, end_date: endDate });
      toast.success(S.offerDetail.submitted);
      setApplyOpen(false);
      navigate(ROUTES.student.applications);
    } catch (error) {
      const apiError = normalizeError(error);
      const fields = Object.values(apiError.fieldErrors);
      setFormError([apiError.message, ...fields].filter(Boolean).join(' '));
    }
  };

  return (
    <div className="max-w-content">
      <Link
        to={ROUTES.student.offers}
        className="whitespace-pre text-[13px] leading-4 text-muted hover:underline"
      >
        {S.offerDetail.back}
      </Link>

      <div className="mt-[14px] flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-10">
        <article className="min-h-[560px] w-full rounded-panel bg-mint px-4 pb-6 pt-[30px] sm:px-6 lg:w-[820px]">
          <h1 className="text-[24px] font-bold leading-[29px] text-forest-900">{data.title}</h1>
          <p className="mt-[7px] text-[14px] leading-[17px] text-muted">
            {companyName}  •  {data.location}
          </p>
          <div className="mt-[27px] w-full max-w-[760px] space-y-0">
            <Section title={S.offerDetail.description}>{data.description}</Section>
            <Section title={S.offerDetail.requirements}>{data.requirements}</Section>
            <Section title={S.offerDetail.datesPlaces}>{`${places}  •  ${data.location}`}</Section>
            <Section title={S.offerDetail.deadline}>{formatDate(data.deadline)}</Section>
            <Section title={S.offerDetail.companyContact}>
              {contact || S.offerDetail.notProvided}
            </Section>
          </div>
        </article>

        <aside className="relative flex min-h-[300px] w-full flex-col rounded-panel bg-mint px-[22px] pb-[26px] pt-[26px] lg:w-[260px] lg:shrink-0">
          <h2 className="text-[16px] font-semibold leading-[19px] text-forest-900">
            {S.offerDetail.applyTitle}
          </h2>
          <p className="mt-[15px] text-[12px] leading-[15px] text-muted">
            {S.offerDetail.applyHint}
          </p>
          {hasApplied ? (
            <div className="mt-auto space-y-3 pt-8">
              <p className="text-[12px] text-muted">{S.offerDetail.applied}</p>
              <Button
                variant="secondary"
                className="h-10 w-full"
                onClick={() => {
                  if (existing.data) navigate(ROUTES.student.applicationDetail(existing.data.id));
                }}
              >
                {S.offerDetail.viewApplication}
              </Button>
            </div>
          ) : (
            <div className="mt-auto space-y-2 pt-8">
              {deadlinePassed && (
                <p className="text-[12px] text-pill-danger-fg">{S.offerDetail.deadlinePassed}</p>
              )}
              {notOpen && <p className="text-[12px] text-pill-danger-fg">{S.offerDetail.notOpen}</p>}
              <Button className="h-10 w-full" disabled={!canApply} onClick={openApply}>
                {S.offerDetail.submit}
              </Button>
            </div>
          )}
        </aside>
      </div>

      <Modal
        open={applyOpen}
        onClose={closeApply}
        title={S.offerDetail.modalTitle}
        footer={
          <>
            <Button variant="secondary" onClick={closeApply} disabled={submit.isPending}>
              {S.offerDetail.cancel}
            </Button>
            <Button onClick={() => void confirmApply()} isLoading={submit.isPending}>
              {S.offerDetail.confirm}
            </Button>
          </>
        }
      >
        <p className="mb-5 text-[13px] text-muted">
          {S.offerDetail.modalHint} <span className="font-semibold text-forest-900">{data.title}</span>.
        </p>
        <div className="space-y-4">
          <Field label={S.offerDetail.startDate} error={formError ?? undefined}>
            <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </Field>
          <Field label={S.offerDetail.endDate}>
            <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
