import type { Internship, InternshipSubmission } from '@/api/internships';
import { deriveSupervisorSummary } from './summary';

const internship = (id: string, student: string, status: Internship['status']) =>
  ({ id, student_user_id: student, status }) as Internship;
const submission = (version: number, status: InternshipSubmission['status']) =>
  ({ version, status }) as InternshipSubmission;

describe('deriveSupervisorSummary', () => {
  it('counts students, active internships, pending reviews and evaluations', () => {
    const result = deriveSupervisorSummary([
      { internship: internship('1', 's1', 'in_progress'), submissions: [submission(1, 'REJECTED'), submission(2, 'SUBMITTED')], hasEvaluation: false },
      { internship: internship('2', 's2', 'confirmed'), submissions: [], hasEvaluation: false },
      { internship: internship('3', 's3', 'completed'), submissions: [submission(1, 'APPROVED')], hasEvaluation: true },
    ]);
    expect(result).toEqual({ assigned: 3, active: 2, pendingReviews: 1, evaluationsRecorded: 1 });
  });
  it('uses only the latest submission version', () => {
    const result = deriveSupervisorSummary([
      { internship: internship('1', 's1', 'in_progress'), submissions: [submission(2, 'APPROVED'), submission(1, 'SUBMITTED')], hasEvaluation: false },
    ]);
    expect(result.pendingReviews).toBe(0);
  });
});
