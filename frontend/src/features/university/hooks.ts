import { useMemo } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listApplications,
  listApplicationHistory,
  getApplication,
  postUniversityDecision,
  type Application,
  type ApplicationStatus,
  type CompanyDecisionValue,
  type ListApplicationsParams,
} from '@/api/applications';
import {
  createAdminUser,
  listAdminUsers,
  updateAdminUser,
  type AdminUserCreateRequest,
  type AdminUserCreateResponse,
  type AdminUserSummary,
  type AdminUserUpdateRequest,
} from '@/api/identity';
import {
  approveCancellationRequest,
  assignSupervisor,
  getInternship,
  listCancellationRequests,
  listInternships,
  rejectCancellationRequest,
  type CancellationRequest,
  type Internship,
  type ListInternshipsParams,
} from '@/api/internships';
import { userKeys } from '@/features/directory/users';
import { normalizeError } from '@/lib/errors';
import {
  normalizeDrfPage,
  normalizeOffsetPage,
  pageToOffset,
  PAGE_SIZE,
} from '@/lib/pagination';
import { universityKeys } from './keys';

const AGGREGATE_LIMIT = 100;

type ApplicationActivity = Pick<Application, 'student_user_id'>;
type InternshipActivity = Pick<
  Internship,
  'student_user_id' | 'status' | 'supervisor_user_id'
>;

const NO_STUDENT_ACTIVITY = new Map<string, UniversityStudentActivity>();
const NO_SUPERVISOR_ACTIVITY = new Map<string, number>();

/** Identity rejects scoped writes when the caller's own university is empty. */
export function isUniversityScopeError(error: unknown): boolean {
  const apiError = normalizeError(error);
  return apiError.status === 403 && /no university assigned/i.test(apiError.message);
}

function useInvalidateUniversity() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: universityKeys.all });
  };
}

export interface UniversityApplicationParams {
  page: number;
  status?: ApplicationStatus | '';
}

export function useUniversityApplications({ page, status }: UniversityApplicationParams) {
  const params: ListApplicationsParams = {
    ...pageToOffset(page),
    ...(status ? { status } : {}),
    ordering: '-created_at',
  };
  return useQuery({
    queryKey: universityKeys.applications(params),
    queryFn: async () => normalizeOffsetPage(await listApplications(params)),
    placeholderData: keepPreviousData,
  });
}

export function useUniversityApplication(id: string | undefined) {
  return useQuery({
    queryKey: universityKeys.application(id ?? ''),
    queryFn: () => getApplication(id as string),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useUniversityApplicationHistory(id: string | undefined) {
  return useQuery({
    queryKey: universityKeys.history(id ?? ''),
    queryFn: async () => (await listApplicationHistory(id as string)).results,
    enabled: Boolean(id),
    retry: false,
  });
}

export interface UniversityInternshipParams {
  page: number;
  status?: ListInternshipsParams['status'];
}

export function useUniversityInternships({ page, status }: UniversityInternshipParams) {
  const params: ListInternshipsParams = {
    ...pageToOffset(page),
    ...(status ? { status } : {}),
    ordering: '-created_at',
  };
  return useQuery({
    queryKey: universityKeys.internships(params),
    queryFn: async () => normalizeOffsetPage(await listInternships(params)),
    placeholderData: keepPreviousData,
  });
}

export interface UniversityDashboardData {
  pendingApplications: Application[];
  studentCount: number;
  activityStudentCount: number;
  unassignedCount: number;
  activeCount: number;
}

/** Registered count drives the stat; activity is retained as supporting detail. */
export function buildUniversityDashboard(
  pendingApplications: Application[],
  internships: Internship[],
  registeredStudentCount: number,
): UniversityDashboardData {
  const studentsWithActivity = new Set<string>(
    pendingApplications.map((item) => item.student_user_id),
  );
  internships.forEach((item) => studentsWithActivity.add(item.student_user_id));
  const active = internships.filter(
    (item) => item.status === 'confirmed' || item.status === 'in_progress',
  );
  return {
    pendingApplications,
    studentCount: registeredStudentCount,
    activityStudentCount: studentsWithActivity.size,
    unassignedCount: active.filter((item) => !item.supervisor_user_id).length,
    activeCount: active.length,
  };
}

export function useUniversityDashboard() {
  return useQuery<UniversityDashboardData>({
    queryKey: universityKeys.dashboard,
    queryFn: async () => {
      const [pending, allInternships, students] = await Promise.all([
        listApplications({ status: 'COMPANY_ACCEPTED', limit: AGGREGATE_LIMIT, offset: 0 }),
        listInternships({ limit: AGGREGATE_LIMIT, offset: 0 }),
        listAdminUsers({ role: 'student', page: 1 }),
      ]);
      return buildUniversityDashboard(pending.results, allInternships.results, students.count);
    },
  });
}

export interface UniversityRosterParams {
  page: number;
  q?: string;
}

export interface UniversityStudentActivity {
  applicationsCount: number;
  internshipStatus?: Internship['status'];
}

export interface UniversityStudentRow {
  user: AdminUserSummary;
  applicationsCount: number;
  internshipStatus?: Internship['status'];
}

export function buildStudentActivity(
  applications: ApplicationActivity[],
  internships: InternshipActivity[],
): Map<string, UniversityStudentActivity> {
  const byStudent = new Map<string, UniversityStudentActivity>();
  for (const item of applications) {
    const row = byStudent.get(item.student_user_id) ?? { applicationsCount: 0 };
    row.applicationsCount += 1;
    byStudent.set(item.student_user_id, row);
  }
  for (const item of internships) {
    const row = byStudent.get(item.student_user_id) ?? { applicationsCount: 0 };
    row.internshipStatus = item.status;
    byStudent.set(item.student_user_id, row);
  }
  return byStudent;
}

export function mergeStudentRows(
  users: AdminUserSummary[],
  activity: Map<string, UniversityStudentActivity>,
): UniversityStudentRow[] {
  return users.map((user) => {
    const stats = activity.get(user.id);
    return {
      user,
      applicationsCount: stats?.applicationsCount ?? 0,
      internshipStatus: stats?.internshipStatus,
    };
  });
}

export function useUniversityStudentRoster({ page, q }: UniversityRosterParams) {
  return useQuery({
    queryKey: universityKeys.studentRoster(page, q?.trim() ?? ''),
    queryFn: async () =>
      normalizeDrfPage(
        await listAdminUsers({ role: 'student', page, q: q?.trim() || undefined }),
      ),
    placeholderData: keepPreviousData,
  });
}

export function useUniversityStudentActivity() {
  return useQuery({
    queryKey: universityKeys.studentActivity,
    queryFn: async () => {
      const [apps, internships] = await Promise.all([
        listApplications({ limit: AGGREGATE_LIMIT, offset: 0 }),
        listInternships({ limit: AGGREGATE_LIMIT, offset: 0 }),
      ]);
      return buildStudentActivity(apps.results, internships.results);
    },
  });
}

export interface UniversityStudentResult {
  rows: UniversityStudentRow[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch(): void;
}

/** Roster from Identity's scoped admin directory, enriched with placement activity. */
export function useUniversityStudents(params: UniversityRosterParams): UniversityStudentResult {
  const roster = useUniversityStudentRoster(params);
  const activity = useUniversityStudentActivity();
  const rows = useMemo(
    () => mergeStudentRows(roster.data?.items ?? [], activity.data ?? NO_STUDENT_ACTIVITY),
    [roster.data, activity.data],
  );
  return {
    rows,
    total: roster.data?.total ?? 0,
    isLoading: roster.isLoading || activity.isLoading,
    isError: roster.isError || activity.isError,
    error: roster.error ?? activity.error,
    refetch: () => {
      void roster.refetch();
      void activity.refetch();
    },
  };
}

export interface UniversitySupervisorRow {
  user: AdminUserSummary;
  assignedCount: number;
}

export function buildSupervisorActivity(
  internships: Pick<Internship, 'supervisor_user_id'>[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of internships) {
    if (!item.supervisor_user_id) continue;
    counts.set(item.supervisor_user_id, (counts.get(item.supervisor_user_id) ?? 0) + 1);
  }
  return counts;
}

export function mergeSupervisorRows(
  users: AdminUserSummary[],
  counts: Map<string, number>,
): UniversitySupervisorRow[] {
  return users.map((user) => ({ user, assignedCount: counts.get(user.id) ?? 0 }));
}

export function useUniversitySupervisorRoster({ page, q }: UniversityRosterParams) {
  return useQuery({
    queryKey: universityKeys.supervisorRoster(page, q?.trim() ?? ''),
    queryFn: async () =>
      normalizeDrfPage(
        await listAdminUsers({ role: 'supervisor', page, q: q?.trim() || undefined }),
      ),
    placeholderData: keepPreviousData,
  });
}

export function useUniversitySupervisorActivity() {
  return useQuery({
    queryKey: universityKeys.supervisorActivity,
    queryFn: async () => {
      const internships = await listInternships({ limit: AGGREGATE_LIMIT, offset: 0 });
      return buildSupervisorActivity(internships.results);
    },
  });
}

export interface UniversitySupervisorResult {
  rows: UniversitySupervisorRow[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch(): void;
}

/** Roster from Identity's scoped admin directory, enriched with assignment counts. */
export function useUniversitySupervisors(
  params: UniversityRosterParams,
): UniversitySupervisorResult {
  const roster = useUniversitySupervisorRoster(params);
  const activity = useUniversitySupervisorActivity();
  const rows = useMemo(
    () =>
      mergeSupervisorRows(
        roster.data?.items ?? [],
        activity.data ?? NO_SUPERVISOR_ACTIVITY,
      ),
    [roster.data, activity.data],
  );
  return {
    rows,
    total: roster.data?.total ?? 0,
    isLoading: roster.isLoading || activity.isLoading,
    isError: roster.isError || activity.isError,
    error: roster.error ?? activity.error,
    refetch: () => {
      void roster.refetch();
      void activity.refetch();
    },
  };
}

/** All scoped supervisors for the assignment picker (20 per API page). */
export function useUniversitySupervisorOptions() {
  return useQuery({
    queryKey: universityKeys.supervisorOptions,
    queryFn: async () => {
      const first = await listAdminUsers({ role: 'supervisor', page: 1 });
      const pages = Math.ceil(first.count / PAGE_SIZE);
      if (pages <= 1) return first.results;
      const rest = await Promise.all(
        Array.from({ length: pages - 1 }, (_, index) =>
          listAdminUsers({ role: 'supervisor', page: index + 2 }),
        ),
      );
      return [first, ...rest].flatMap((page) => page.results);
    },
    staleTime: 5 * 60_000,
  });
}

/** Assignments only make sense for live placements. */
export function isAssignableInternship(status: Internship['status']): boolean {
  return status === 'confirmed' || status === 'in_progress';
}

/** Single internship for deep links that point outside the aggregated assignment list. */
export function useUniversityInternship(id: string | undefined) {
  return useQuery({
    queryKey: universityKeys.internship(id ?? ''),
    queryFn: () => getInternship(id as string),
    enabled: Boolean(id),
    retry: false,
  });
}

/** Confirmed placements need a supervisor; in-progress ones can be reassigned. */
export function useUniversityAssignments() {
  return useQuery<Internship[]>({
    queryKey: universityKeys.assignments,
    queryFn: async () => {
      const [confirmed, active] = await Promise.all([
        listInternships({ status: 'confirmed', limit: AGGREGATE_LIMIT, offset: 0 }),
        listInternships({ status: 'in_progress', limit: AGGREGATE_LIMIT, offset: 0 }),
      ]);
      const byId = new Map<string, Internship>();
      [...confirmed.results, ...active.results].forEach((item) => byId.set(item.id, item));
      return [...byId.values()];
    },
  });
}

export interface UniversityCancellationRow {
  request: CancellationRequest;
  internship: Internship;
}

/** No global endpoint: aggregate per internship, bounded by `limit` (design-plan §3.4). */
export function useUniversityCancellations(limit = AGGREGATE_LIMIT) {
  return useQuery<UniversityCancellationRow[]>({
    queryKey: [...universityKeys.cancellations, limit] as const,
    queryFn: async () => {
      const internships = await listInternships({ limit, offset: 0 });
      const groups = await Promise.all(
        internships.results.map(async (internship) => {
          try {
            const requests = await listCancellationRequests(internship.id);
            return requests.map((request) => ({ request, internship }));
          } catch {
            return [] as UniversityCancellationRow[];
          }
        }),
      );
      return groups
        .flat()
        .sort((a, b) => b.request.created_at.localeCompare(a.request.created_at));
    },
  });
}

export function useUniversityDecision() {
  const invalidate = useInvalidateUniversity();
  return useMutation({
    mutationFn: ({
      id,
      decision,
      reason,
    }: {
      id: string;
      decision: CompanyDecisionValue;
      reason?: string;
    }) => postUniversityDecision(id, decision, reason),
    onSuccess: invalidate,
  });
}

export function useAssignSupervisor() {
  const invalidate = useInvalidateUniversity();
  return useMutation({
    mutationFn: ({
      internshipId,
      supervisorUserId,
      reason,
    }: {
      internshipId: string;
      supervisorUserId: string;
      reason?: string;
    }) => assignSupervisor(internshipId, supervisorUserId, reason),
    onSuccess: invalidate,
  });
}

export function useApproveCancellation() {
  const invalidate = useInvalidateUniversity();
  return useMutation({
    mutationFn: ({ internshipId, requestId }: { internshipId: string; requestId: string }) =>
      approveCancellationRequest(internshipId, requestId),
    onSuccess: invalidate,
  });
}

export function useRejectCancellation() {
  const invalidate = useInvalidateUniversity();
  return useMutation({
    mutationFn: ({
      internshipId,
      requestId,
      reason,
    }: {
      internshipId: string;
      requestId: string;
      reason: string;
    }) => rejectCancellationRequest(internshipId, requestId, reason),
    onSuccess: invalidate,
  });
}

export function useProvisionUniversityUser() {
  const invalidate = useInvalidateUniversity();
  return useMutation<AdminUserCreateResponse, unknown, AdminUserCreateRequest>({
    mutationFn: (input) => createAdminUser(input),
    onSuccess: () => {
      invalidate();
    },
  });
}

export function useUpdateUniversityUser() {
  const client = useQueryClient();
  const invalidate = useInvalidateUniversity();
  return useMutation({
    mutationFn: ({ userId, input }: { userId: string; input: AdminUserUpdateRequest }) =>
      updateAdminUser(userId, input),
    onSuccess: (_data, variables) => {
      invalidate();
      void client.invalidateQueries({ queryKey: userKeys.detail(variables.userId) });
    },
  });
}
