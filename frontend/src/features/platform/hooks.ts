import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAdminUser,
  listAdminCompanies,
  listAdminUsers,
  rejectAdminCompany,
  updateAdminUser,
  verifyAdminCompany,
  type AdminUserCreateRequest,
  type AdminUserUpdateRequest,
  type Role,
  type VerificationStatus,
} from '@/api/identity';
import { normalizeDrfPage } from '@/lib/pagination';
import { platformKeys } from './keys';

export function useAdminCompanies(status: VerificationStatus, page: number) {
  return useQuery({
    queryKey: platformKeys.companies(status, page),
    queryFn: async () => normalizeDrfPage(await listAdminCompanies({ status, page })),
    placeholderData: keepPreviousData,
  });
}

/** `count` from DRF page 1 — the stat cards only need the total. */
export function useAdminCompanyCount(status: VerificationStatus) {
  return useQuery({
    queryKey: platformKeys.companyCount(status),
    queryFn: async () => (await listAdminCompanies({ status, page: 1 })).count,
    staleTime: 30_000,
  });
}

export function useAdminUsers(role: Role, page: number) {
  return useQuery({
    queryKey: platformKeys.users(role, page),
    queryFn: async () => normalizeDrfPage(await listAdminUsers({ role, page })),
    placeholderData: keepPreviousData,
  });
}

export function useAdminUserCount(role: Role) {
  return useQuery({
    queryKey: platformKeys.userCount(role),
    queryFn: async () => (await listAdminUsers({ role, page: 1 })).count,
    staleTime: 30_000,
  });
}

function useInvalidatePlatform() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: platformKeys.all });
}

export function useVerifyCompany() {
  const invalidate = useInvalidatePlatform();
  return useMutation({
    mutationFn: (companyId: string) => verifyAdminCompany(companyId),
    onSuccess: () => void invalidate(),
  });
}

export function useRejectCompany() {
  const invalidate = useInvalidatePlatform();
  return useMutation({
    mutationFn: ({ companyId, reason }: { companyId: string; reason: string }) =>
      rejectAdminCompany(companyId, reason),
    onSuccess: () => void invalidate(),
  });
}

export function useCreateAccount() {
  const invalidate = useInvalidatePlatform();
  return useMutation({
    mutationFn: (input: AdminUserCreateRequest) => createAdminUser(input),
    onSuccess: () => void invalidate(),
  });
}

/** Edit a university account, including the institution used for student/supervisor scoping. */
export function useUpdateUniversityAccount() {
  const invalidate = useInvalidatePlatform();
  return useMutation({
    mutationFn: ({
      userId,
      input,
    }: {
      userId: string;
      input: AdminUserUpdateRequest;
    }) => updateAdminUser(userId, input),
    onSuccess: () => void invalidate(),
  });
}
