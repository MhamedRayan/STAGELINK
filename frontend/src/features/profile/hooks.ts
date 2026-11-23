import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getEvaluation, listInternships, listSubmissions } from '@/api/internships';
import {
  getRoleProfile,
  putRoleProfile,
  updateAccount,
  type CompanyRoleProfile,
  type RoleProfileUpdate,
  type StudentRoleProfile,
  type SupervisorRoleProfile,
} from '@/api/profile';
import { useAuth } from '@/features/auth/AuthProvider';
import { deriveSupervisorSummary, type SupervisorSummary } from './summary';

export const profileKeys = {
  role: ['profile', 'role'] as const,
  supervisorSummary: ['profile', 'supervisor-summary'] as const,
};

function useRoleProfile<T extends StudentRoleProfile | CompanyRoleProfile | SupervisorRoleProfile>() {
  return useQuery({ queryKey: profileKeys.role, queryFn: () => getRoleProfile<T>(), retry: false });
}
export const useStudentProfile = () => useRoleProfile<StudentRoleProfile>();
export const useCompanyProfileMe = () => useRoleProfile<CompanyRoleProfile>();
export const useSupervisorProfile = () => useRoleProfile<SupervisorRoleProfile>();

interface SaveInput {
  /** Sent as PATCH /api/users/me/ (only the changed keys). */
  account?: { name?: string; email?: string };
  /** Sent as PUT /api/users/me/profile/ (complete body). */
  role?: RoleProfileUpdate;
}

/** Saves account fields then the role profile, then refreshes the signed-in user. */
export function useSaveProfile() {
  const queryClient = useQueryClient();
  const { refreshUser } = useAuth();
  return useMutation({
    mutationFn: async ({ account, role }: SaveInput) => {
      if (account && Object.keys(account).length > 0) await updateAccount(account);
      if (role) await putRoleProfile(role);
    },
    onSuccess: async () => {
      await Promise.all([refreshUser(), queryClient.invalidateQueries({ queryKey: profileKeys.role })]);
    },
  });
}

const MAX_INTERNSHIPS = 50; // design-plan §3.5: counts need per-internship calls, so cap the load.

export function useSupervisorSummary() {
  return useQuery<SupervisorSummary>({
    queryKey: profileKeys.supervisorSummary,
    staleTime: 60_000,
    queryFn: async () => {
      const page = await listInternships({ mine: true, limit: MAX_INTERNSHIPS, offset: 0 });
      const details = await Promise.all(
        page.results.map(async (internship) => {
          const [submissions, evaluation] = await Promise.all([
            listSubmissions(internship.id),
            getEvaluation(internship.id),
          ]);
          return { internship, submissions, hasEvaluation: evaluation !== null };
        }),
      );
      return deriveSupervisorSummary(details);
    },
  });
}
