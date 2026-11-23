import type { Internship, InternshipSubmission } from '@/api/internships';

export interface SupervisorSummary {
  assigned: number;
  active: number;
  pendingReviews: number;
  evaluationsRecorded: number;
}

export interface InternshipDetail {
  internship: Internship;
  submissions: InternshipSubmission[];
  hasEvaluation: boolean;
}

/** Counts for the supervisor profile (design-plan §3.5): all derived client-side. */
export function deriveSupervisorSummary(details: InternshipDetail[]): SupervisorSummary {
  const summary: SupervisorSummary = { assigned: 0, active: 0, pendingReviews: 0, evaluationsRecorded: 0 };
  const students = new Set<string>();
  for (const { internship, submissions, hasEvaluation } of details) {
    students.add(internship.student_user_id);
    if (internship.status === 'confirmed' || internship.status === 'in_progress') summary.active += 1;
    const latest = submissions.reduce<InternshipSubmission | null>(
      (best, current) => (best === null || current.version > best.version ? current : best),
      null,
    );
    if (latest?.status === 'SUBMITTED') summary.pendingReviews += 1;
    if (hasEvaluation) summary.evaluationsRecorded += 1;
  }
  summary.assigned = students.size;
  return summary;
}
