import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useCompanyProfile } from '@/features/directory/companies';
import { useOffer } from '@/features/offers/hooks';
import { formatDate } from '@/lib/format';
import { S } from '../strings';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-h-[90px]">
      <h2 className="text-[16px] font-semibold leading-[19px] text-forest-900">{title}</h2>
      <div className="mt-[11px] whitespace-pre-wrap text-[13px] leading-4 text-forest-900">{children}</div>
    </section>
  );
}

/** Offer Details (guest) — Figma 24:87. Deltas per design-plan §3.1: no start/end, no phone/email. */
export function GuestOfferDetailPage() {
  const { offerId } = useParams();
  const { data: offer, isLoading, error, refetch } = useOffer(offerId);
  const { data: company } = useCompanyProfile(offer?.company_user_id);
  const contact = [company?.address, company?.website].filter((v): v is string => Boolean(v?.trim()));
  const places = offer ? (offer.capacity === 1 ? '1 place' : `${offer.capacity} places`) : '';

  return (
    <>
      <PublicHeader minimal />
      <main className="px-4 pb-12 pt-6 sm:px-[60px] sm:pt-7">
        <Link to={ROUTES.guest.offers} className="whitespace-pre text-[13px] leading-4 text-muted hover:underline">
          {S.detail.back}
        </Link>

        <div className="mt-[14px] flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-10">
          {error ? (
            <div className="w-full lg:w-[820px]">
              <ErrorState error={error} onRetry={() => void refetch()} />
            </div>
          ) : isLoading || !offer ? (
            <Skeleton className="h-[420px] w-full rounded-panel sm:h-[700px] lg:w-[820px]" />
          ) : (
            <>
              <article className="min-h-[560px] w-full rounded-panel bg-mint px-4 pb-6 pt-[30px] sm:px-6 lg:w-[820px]">
                <h1 className="text-[24px] font-bold leading-[29px] text-forest-900">{offer.title}</h1>
                <p className="mt-[7px] text-[14px] leading-[17px] text-muted">
                  {company?.legal_name?.trim() || 'Company'}  •  {offer.location}
                </p>
                <div className="mt-[27px] w-full max-w-[760px] space-y-0">
                  <Section title={S.detail.description}>{offer.description}</Section>
                  <Section title={S.detail.skills}>{offer.requirements}</Section>
                  <Section title={S.detail.datesPlaces}>{`${places}  •  ${offer.location}`}</Section>
                  <Section title={S.detail.deadline}>{formatDate(offer.deadline)}</Section>
                  {contact.length > 0 && <Section title={S.detail.contact}>{contact.join('   •   ')}</Section>}
                </div>
              </article>

              <aside className="flex min-h-[300px] w-full flex-col rounded-panel bg-mint px-[22px] pb-[26px] pt-[26px] lg:w-[460px]">
                <h2 className="text-[16px] font-semibold leading-[19px] text-forest-900">{S.detail.applyTitle}</h2>
                <p className="mt-[15px] text-[12px] leading-[15px] text-muted">{S.detail.applyBody}</p>
                <Link
                  to={ROUTES.login}
                  className="clickable mt-auto flex h-11 w-full max-w-[420px] items-center rounded-[10px] bg-pill-neutral-bg px-4 text-[13px] font-medium text-muted hover:brightness-95 sm:pl-32"
                >
                  {S.detail.cta}
                </Link>
              </aside>
            </>
          )}
        </div>
      </main>
    </>
  );
}
