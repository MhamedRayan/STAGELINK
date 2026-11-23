import { useQuery } from '@tanstack/react-query';
import { getPublicCompanyProfile } from '@/api/companies';

export const companyKeys = {
  profile: (companyId: string) => ['company-profile', companyId] as const,
};

/** Public profile of a company; undefined while loading or when it cannot be resolved. */
export function useCompanyProfile(companyId: string | undefined) {
  return useQuery({
    queryKey: companyKeys.profile(companyId ?? ''),
    queryFn: () => getPublicCompanyProfile(companyId as string),
    enabled: Boolean(companyId),
    staleTime: 10 * 60_000,
    retry: false,
  });
}

/** Company display name; honest fallback "Company" (design-plan §3.1 Notes). */
export function useCompanyLabel(companyId: string | undefined): string {
  const { data } = useCompanyProfile(companyId);
  return data?.legal_name?.trim() || 'Company';
}
