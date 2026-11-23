import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approveSubmission,
  completeInternship,
  createEvaluation,
  downloadSubmission,
  getEvaluation,
  getInternship,
  getInternshipHistory,
  listInternships,
  listSubmissions,
  rejectSubmission,
  startInternship,
  type Internship,
  type InternshipSubmission,
} from '@/api/internships';
import { normalizeOffsetPage } from '@/lib/pagination';
import { supervisorKeys } from './keys';

const DASHBOARD_CAP = 50;
const STUDENTS_CAP = 100;

function useInvalidateSupervisor() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: supervisorKeys.all });
  };
}

export type ReviewState = 'evaluated' | 'pending' | 'awaiting' | 'progress';

export interface SupervisorDashboardRow {
  internship: Internship;
  reviewState: ReviewState;
}

export function useSupervisorInternships(limit = STUDENTS_CAP) {
  return useQuery({
    queryKey: supervisorKeys.internships({ mine: true, limit }),
    queryFn: async () => normalizeOffsetPage(await listInternships({ mine: true, limit, offset: 0 })),
    staleTime: 60_000,
  });
}

export interface SupervisorDashboardData {
  rows: SupervisorDashboardRow[];
  studentCount: number;
  activeCount: number;
  pendingReviews: number;
  evaluationsToComplete: number;
}

/** Per-internship calls are capped at 50 and cached for a minute (design-plan §3.5 Δ). */
export function useSupervisorDashboard() {
  return useQuery<SupervisorDashboardData>({
    queryKey: supervisorKeys.dashboard,
    staleTime: 60_000,
    queryFn: async () => {
      const page = normalizeOffsetPage(
        await listInternships({ mine: true, limit: DASHBOARD_CAP, offset: 0 }),
      );
      const details = await Promise.all(
        page.items.map(async (internship) => {
          const [submissions, evaluation] = await Promise.all([
            listSubmissions(internship.id).catch(() => [] as InternshipSubmission[]),
            getEvaluation(internship.id).catch(() => null),
          ]);
          const latest = submissions.reduce<InternshipSubmission | null>(
            (best, current) => (best === null || current.version > best.version ? current : best),
            null,
          );
          const reviewState: ReviewState = evaluation
            ? 'evaluated'
            : latest?.status === 'SUBMITTED'
              ? 'pending'
              : latest?.status === 'APPROVED'
                ? 'awaiting'
                : 'progress';
          return { internship, reviewState, hasEvaluation: Boolean(evaluation) };
        }),
      );
      const students = new Set(details.map((item) => item.internship.student_user_id));
      return {
        rows: details.map(({ internship, reviewState }) => ({ internship, reviewState })),
        studentCount: students.size,
        activeCount: details.filter(
          (item) =>
            item.internship.status === 'confirmed' || item.internship.status === 'in_progress',
        ).length,
        pendingReviews: details.filter((item) => item.reviewState === 'pending').length,
        evaluationsToComplete: details.filter(
          (item) => item.reviewState === 'awaiting' && !item.hasEvaluation,
        ).length,
      };
    },
  });
}

export function useInternship(id: string | undefined) {
  return useQuery({
    queryKey: supervisorKeys.internship(id ?? ''),
    queryFn: () => getInternship(id as string),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useInternshipHistory(id: string | undefined) {
  return useQuery({
    queryKey: supervisorKeys.history(id ?? ''),
    queryFn: () => getInternshipHistory(id as string),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useSubmissions(id: string | undefined) {
  return useQuery({
    queryKey: supervisorKeys.submissions(id ?? ''),
    queryFn: () => listSubmissions(id as string),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useEvaluation(id: string | undefined) {
  return useQuery({
    queryKey: supervisorKeys.evaluation(id ?? ''),
    queryFn: () => getEvaluation(id as string),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useStartInternship() {
  const invalidate = useInvalidateSupervisor();
  return useMutation({ mutationFn: startInternship, onSuccess: invalidate });
}

export function useCompleteInternship() {
  const invalidate = useInvalidateSupervisor();
  return useMutation({ mutationFn: completeInternship, onSuccess: invalidate });
}

export function useApproveSubmission() {
  const invalidate = useInvalidateSupervisor();
  return useMutation({
    mutationFn: ({ internshipId, submissionId, reason }: {
      internshipId: string;
      submissionId: string;
      reason: string;
    }) => approveSubmission(internshipId, submissionId, reason),
    onSuccess: invalidate,
  });
}

export function useRejectSubmission() {
  const invalidate = useInvalidateSupervisor();
  return useMutation({
    mutationFn: ({ internshipId, submissionId, reason }: {
      internshipId: string;
      submissionId: string;
      reason: string;
    }) => rejectSubmission(internshipId, submissionId, reason),
    onSuccess: invalidate,
  });
}

export function useCreateEvaluation() {
  const invalidate = useInvalidateSupervisor();
  return useMutation({
    mutationFn: ({ internshipId, grade, comment }: {
      internshipId: string;
      grade: string;
      comment?: string;
    }) => createEvaluation(internshipId, grade, comment),
    onSuccess: invalidate,
  });
}

export function useDownloadSubmission() {
  return useMutation({
    mutationFn: ({ internshipId, submissionId, filename }: {
      internshipId: string;
      submissionId: string;
      filename: string;
    }) => downloadSubmission(internshipId, submissionId, filename),
  });
}
