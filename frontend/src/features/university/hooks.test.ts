import type { Application } from '@/api/applications';
import type { AdminUserSummary } from '@/api/identity';
import type { Internship } from '@/api/internships';
import { ApiError } from '@/lib/errors';
import {
  buildStudentActivity,
  buildSupervisorActivity,
  buildUniversityDashboard,
  isAssignableInternship,
  isStartableInternship,
  isUniversityScopeError,
  mergeStudentRows,
  mergeSupervisorRows,
} from './hooks';

const student: AdminUserSummary = {
  id: 'student-1',
  name: 'Amina Njeri',
  email: 'amina@example.com',
  role: 'student',
  is_active: true,
  university: 'Demo University',
};

const supervisor: AdminUserSummary = {
  id: 'supervisor-1',
  name: 'Dr. Paul',
  email: 'paul@example.com',
  role: 'supervisor',
  is_active: true,
  university: 'Demo University',
};

describe('university roster helpers', () => {
  it('counts applications and keeps the latest internship status per student', () => {
    const applications: Array<Pick<Application, 'student_user_id'>> = [
      { student_user_id: 'student-1' },
      { student_user_id: 'student-1' },
      { student_user_id: 'student-2' },
    ];
    const internships: Array<
      Pick<Internship, 'student_user_id' | 'status' | 'supervisor_user_id'>
    > = [
      {
        student_user_id: 'student-1',
        status: 'confirmed',
        supervisor_user_id: 'supervisor-1',
      },
      {
        student_user_id: 'student-1',
        status: 'in_progress',
        supervisor_user_id: 'supervisor-1',
      },
    ];

    const activity = buildStudentActivity(applications, internships);
    expect(activity.get('student-1')).toEqual({
      applicationsCount: 2,
      internshipStatus: 'in_progress',
    });
    expect(activity.get('student-2')).toEqual({ applicationsCount: 1 });
  });

  it('merges roster rows with activity and defaults missing students to zero', () => {
    const activity = buildStudentActivity([{ student_user_id: 'student-1' }], []);
    const rows = mergeStudentRows([student, { ...student, id: 'student-2' }], activity);

    expect(rows).toEqual([
      { user: student, applicationsCount: 1, internshipStatus: undefined },
      {
        user: { ...student, id: 'student-2' },
        applicationsCount: 0,
        internshipStatus: undefined,
      },
    ]);
  });

  it('counts only assigned internships for supervisors', () => {
    const counts = buildSupervisorActivity([
      { supervisor_user_id: 'supervisor-1' },
      { supervisor_user_id: 'supervisor-1' },
      { supervisor_user_id: null },
    ]);

    expect([...counts.entries()]).toEqual([['supervisor-1', 2]]);
    expect(mergeSupervisorRows([supervisor], counts)).toEqual([
      { user: supervisor, assignedCount: 2 },
    ]);
  });

  it('only allows assignments on live placements', () => {
    expect(isAssignableInternship('confirmed')).toBe(true);
    expect(isAssignableInternship('in_progress')).toBe(true);
    expect(isAssignableInternship('completed')).toBe(false);
    expect(isAssignableInternship('cancelled')).toBe(false);
  });

  it('only allows starting confirmed placements', () => {
    expect(isStartableInternship('confirmed')).toBe(true);
    expect(isStartableInternship('in_progress')).toBe(false);
    expect(isStartableInternship('completed')).toBe(false);
    expect(isStartableInternship('cancelled')).toBe(false);
  });

  it('uses the registered student count and keeps activity as a separate detail', () => {
    const application = (studentUserId: string): Application => ({
      id: `app-${studentUserId}`,
      offer_id: 'offer-1',
      company_user_id: 'company-1',
      student_user_id: studentUserId,
      start_date: '2026-01-01',
      end_date: '2026-06-01',
      status: 'COMPANY_ACCEPTED',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });
    const internship = (
      studentUserId: string,
      status: Internship['status'],
      supervisorUserId: string | null = null,
    ): Internship => ({
      id: `internship-${studentUserId}`,
      source_application_id: `app-${studentUserId}`,
      student_user_id: studentUserId,
      company_user_id: 'company-1',
      offer_id: 'offer-1',
      supervisor_user_id: supervisorUserId,
      start_date: '2026-01-01',
      end_date: '2026-06-01',
      status,
      created_at: '2026-01-01T00:00:00Z',
    });

    const dashboard = buildUniversityDashboard(
      [application('student-1'), application('student-1')],
      [
        internship('student-1', 'confirmed'),
        internship('student-2', 'in_progress', 'supervisor-1'),
        internship('student-3', 'completed'),
      ],
      5,
    );

    expect(dashboard.studentCount).toBe(5);
    expect(dashboard.activityStudentCount).toBe(3);
    expect(dashboard.unassignedCount).toBe(1);
    expect(dashboard.activeCount).toBe(2);
  });

  it('detects the missing-university 403 from Identity', () => {
    expect(
      isUniversityScopeError(
        new ApiError({
          status: 403,
          message: 'Your account has no university assigned; contact a platform administrator.',
        }),
      ),
    ).toBe(true);
    expect(
      isUniversityScopeError(
        new ApiError({ status: 403, message: 'Only platform administrators may perform this action.' }),
      ),
    ).toBe(false);
  });
});
