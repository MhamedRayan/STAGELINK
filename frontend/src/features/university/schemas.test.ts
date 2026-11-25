import { editUniversityUserSchema, provisionAccountSchema } from './schemas';

const account = {
  name: 'Amina Njeri',
  email: 'amina@example.com',
  password: 'longenough1',
};

const student = {
  ...account,
  role: 'student' as const,
  matricule: 'STU-001',
  department: 'Computer Science',
  specialty: 'Software Engineering',
  academicYear: '3rd year',
  grade: '',
};

const supervisor = {
  ...account,
  role: 'supervisor' as const,
  matricule: '',
  department: 'Computer Science',
  specialty: '',
  academicYear: '',
  grade: '17.50',
};

describe('university schemas', () => {
  it('requires an explicit initial password of at least 8 characters', () => {
    expect(provisionAccountSchema.safeParse({ ...student, password: '' }).success).toBe(false);
    expect(provisionAccountSchema.safeParse({ ...student, password: 'short' }).success).toBe(false);
    expect(provisionAccountSchema.safeParse(student).success).toBe(true);
  });

  it('requires all student profile fields at creation', () => {
    expect(provisionAccountSchema.safeParse({ ...student, matricule: '' }).success).toBe(false);
    expect(provisionAccountSchema.safeParse({ ...student, department: '' }).success).toBe(false);
    expect(provisionAccountSchema.safeParse({ ...student, specialty: '' }).success).toBe(false);
    expect(provisionAccountSchema.safeParse({ ...student, academicYear: '' }).success).toBe(false);
  });

  it('requires department and grade at supervisor creation', () => {
    expect(provisionAccountSchema.safeParse(supervisor).success).toBe(true);
    expect(provisionAccountSchema.safeParse({ ...supervisor, grade: '' }).success).toBe(false);
    expect(provisionAccountSchema.safeParse({ ...supervisor, department: '' }).success).toBe(false);
  });

  it('rejects a blank name or malformed email', () => {
    expect(provisionAccountSchema.safeParse({ ...student, name: '  ' }).success).toBe(false);
    expect(provisionAccountSchema.safeParse({ ...student, email: 'not-an-email' }).success).toBe(
      false,
    );
  });

  it('accepts blank optional academic fields on an edit', () => {
    expect(
      editUniversityUserSchema.safeParse({
        name: 'Amina Njeri',
        email: 'amina@example.com',
        department: '',
        specialty: '',
        academicYear: '',
        matricule: '',
      }).success,
    ).toBe(true);
  });
});
