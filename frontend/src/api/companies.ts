import { http } from './http';
import type { components } from './schema/identity';

export type PublicCompanyProfile = components['schemas']['PublicCompanyProfile'];

/** Public company profile (identity service). Only verified companies resolve. */
export function getPublicCompanyProfile(companyId: string): Promise<PublicCompanyProfile> {
  return http<PublicCompanyProfile>('identity', `/api/companies/${companyId}/profile/`);
}
