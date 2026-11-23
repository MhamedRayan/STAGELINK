import type { Role, VerificationStatus } from '@/api/identity';

export const platformKeys = {
  all: ['platform'] as const,
  companies: (status: VerificationStatus, page: number) =>
    ['platform', 'companies', status, page] as const,
  companyCount: (status: VerificationStatus) => ['platform', 'company-count', status] as const,
  companyProfile: (companyId: string) => ['platform', 'company-profile', companyId] as const,
  users: (role: Role, page: number) => ['platform', 'users', role, page] as const,
  userCount: (role: Role) => ['platform', 'user-count', role] as const,
};
