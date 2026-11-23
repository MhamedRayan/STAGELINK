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
  approveCancellationRequest,
  assignSupervisor,
  listCancellationRequests,
  listInternships,
  rejectCancellationRequest,
  type CancellationRequest,
  type Internship,
  type ListInternshipsParams,
} from '@/api/internships';
import { demoDirectoryUsers } from '@/features/directory/users';
import { normalizeOffsetPage, pageToOffset } from '@/lib/pagination';
import { universityKeys } from './keys';

const AGGREGATE_LIMIT = 100;

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
  unassignedCount: number;
  activeCount: number;
}

/** Distinct student ids across applications and internships (design-plan §3.4 Δ). */
export function useUniversityDashboard() {
  return useQuery<UniversityDashboardData>({
    queryKey: universityKeys.dashboard,
    queryFn: async () => {
      const [pending, internships] = await Promise.all([
        listApplications({ status: 'COMPANY_ACCEPTED', limit: AGGREGATE_LIMIT, offset: 0 }),
        listInternships({ limit: AGGREGATE_LIMIT, offset: 0 }),
      ]);
      const apps = pending.results;
      const all = internships.results;
      const students = new Set<string>(apps.map((item) => item.student_user_id));
      all.forEach((item) => students.add(item.student_user_id));
      const active = all.filter((item) => item.status === 'confirmed' || item.status === 'in_progress');
      return {
        pendingApplications: apps,
        studentCount: students.size,
        unassignedCount: active.filter((item) => !item.supervisor_user_id).length,
        activeCount: active.length,
      };
    },
  });
}

export interface UniversityStudentRow {
  userId: string;
  applicationsCount: number;
  internshipStatus?: Internship['status'];
}

export function useUniversityStudents() {
  return useQuery<UniversityStudentRow[]>({
    queryKey: universityKeys.students,
    queryFn: async () => {
      const [apps, internships] = await Promise.all([
        listApplications({ limit: AGGREGATE_LIMIT, offset: 0 }),
        listInternships({ limit: AGGREGATE_LIMIT, offset: 0 }),
      ]);
      const byStudent = new Map<string, UniversityStudentRow>();
      for (const item of apps.results) {
        const row = byStudent.get(item.student_user_id) ?? {
          userId: item.student_user_id,
          applicationsCount: 0,
        };
        row.applicationsCount += 1;
        byStudent.set(row.userId, row);
      }
      for (const item of internships.results) {
        const row = byStudent.get(item.student_user_id) ?? {
          userId: item.student_user_id,
          applicationsCount: 0,
        };
        row.internshipStatus = item.status;
        byStudent.set(row.userId, row);
      }
      return [...byStudent.values()];
    },
  });
}

export interface UniversitySupervisorRow {
  userId: string;
  department: string;
  assignedCount: number;
  isDemo: boolean;
}

export function useUniversitySupervisors() {
  return useQuery<UniversitySupervisorRow[]>({
    queryKey: universityKeys.supervisors,
    queryFn: async () => {
      const internships = await listInternships({ limit: AGGREGATE_LIMIT, offset: 0 });
      const counts = new Map<string, number>();
      for (const item of internships.results) {
        if (!item.supervisor_user_id) continue;
        counts.set(item.supervisor_user_id, (counts.get(item.supervisor_user_id) ?? 0) + 1);
      }
      const rows = new Map<string, UniversitySupervisorRow>();
      for (const user of demoDirectoryUsers('supervisor')) {
        rows.set(user.id, {
          userId: user.id,
          department: user.department ?? 'Academic Faculty',
          assignedCount: counts.get(user.id) ?? 0,
          isDemo: true,
        });
      }
      for (const [userId, assignedCount] of counts) {
        if (!rows.has(userId)) {
          rows.set(userId, { userId, department: 'Academic Faculty', assignedCount, isDemo: false });
        }
      }
      return [...rows.values()];
    },
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
