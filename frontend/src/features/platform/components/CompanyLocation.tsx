import type { AdminCompanySummary } from '@/api/identity';
import { S } from '../strings';

/** Location cell: submitted during registration, available on the admin summary. */
export function CompanyLocation({ company }: { company: AdminCompanySummary }) {
  return <>{company.address?.trim() || S.common.notProvided}</>;
}
