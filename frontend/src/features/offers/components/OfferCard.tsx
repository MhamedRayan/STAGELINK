import { Link } from 'react-router-dom';
import { Pill } from '@/components/ui/Pill';
import { useCompanyLabel } from '@/features/directory/companies';
import type { Offer } from '@/api/offers';
import { formatDate } from '@/lib/format';

interface OfferCardProps {
  offer: Offer;
  /** Offer detail route (title link and whole-card click). */
  to: string;
  ctaLabel: string;
  /** Where the CTA button goes; defaults to `to`. */
  ctaTo?: string;
}

/** Offer card — Figma 24:33: 400×270, radius 16, mint. Shared by guest (A) and student (B) lists. */
export function OfferCard({ offer, to, ctaLabel, ctaTo }: OfferCardProps) {
  const company = useCompanyLabel(offer.company_user_id);
  const places = offer.capacity === 1 ? '1 place' : `${offer.capacity} places`;
  return (
    <article className="clickable relative h-[270px] rounded-panel bg-mint px-[18px] pt-[18px]">
      <Pill tone="success" className="w-24 px-0">
        Internship
      </Pill>
      <h3 className="mt-[18px] truncate text-[16px] font-semibold leading-[19px] text-forest-900">
        <Link to={to} className="after:absolute after:inset-0 after:rounded-panel">
          {offer.title}
        </Link>
      </h3>
      <p className="mt-[9px] truncate text-[13px] leading-4 text-muted">{company}</p>
      <p className="mt-1.5 truncate text-[12px] leading-[15px] text-muted">
        {offer.location}  •  {places}  •  Deadline {formatDate(offer.deadline)}
      </p>
      <p className="mt-[13px] line-clamp-4 text-[12px] leading-[15px] text-forest-900">
        {offer.description}
      </p>
      <Link
        to={ctaTo ?? to}
        className="absolute bottom-5 left-[18px] z-10 flex h-9 w-[220px] max-w-[calc(100%-36px)] items-center rounded-[10px] bg-pill-neutral-bg pl-[22px] text-[12px] font-medium text-muted hover:brightness-95"
      >
        {ctaLabel}
      </Link>
    </article>
  );
}
