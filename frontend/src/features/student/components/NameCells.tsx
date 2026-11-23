import { useCompanyLabel } from '@/features/directory/companies';
import { useOfferTitle } from '@/features/directory/offers';

/** Hooks must run inside a component, not inside a table's `columns.map`. */
export function OfferTitleCell({ offerId }: { offerId: string }) {
  const title = useOfferTitle(offerId);
  return <>{title}</>;
}

export function CompanyNameCell({ companyId }: { companyId: string }) {
  const name = useCompanyLabel(companyId);
  return <>{name}</>;
}
