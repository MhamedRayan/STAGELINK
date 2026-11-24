import type { Application } from '@/api/applications';
import type { AdminUserSummary } from '@/api/identity';
import type { Internship } from '@/api/internships';
import {
  buildStudentActivity,
  buildSupervisorActivity,
  isAssignableInternship,
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
});
