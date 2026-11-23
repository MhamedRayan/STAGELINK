import { useOfferTitle } from '@/features/directory/offers';
import { useUserLabel } from '@/features/directory/users';

/** Name cells: hooks must run in a component, not inside a table column render map. */
export function StudentNameCell({ userId }: { userId: string }) {
  return <>{useUserLabel(userId, 'student')}</>;
}

export function OfferTitleCell({ offerId }: { offerId: string }) {
  return <>{useOfferTitle(offerId)}</>;
}
