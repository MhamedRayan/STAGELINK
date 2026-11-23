import type { AdminCompanySummary } from '@/api/identity';
import { useCompanyLocation } from '../hooks';
import { S } from '../strings';

/** Location cell: the public profile address for verified companies, "Not provided" otherwise. */
export function CompanyLocation({ company }: { company: AdminCompanySummary }) {
  const location = useCompanyLocation(company);
  return <>{location ?? S.common.notProvided}</>;
}
