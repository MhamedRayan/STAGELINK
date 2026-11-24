import { editUniversityUserSchema, provisionAccountSchema } from './schemas';

const account = {
  name: 'Amina Njeri',
  email: 'amina@example.com',
  password: 'longenough1',
};

describe('university schemas', () => {
  it('requires an explicit initial password of at least 8 characters', () => {
    expect(provisionAccountSchema.safeParse({ ...account, password: '' }).success).toBe(false);
    expect(provisionAccountSchema.safeParse({ ...account, password: 'short' }).success).toBe(false);
    expect(provisionAccountSchema.safeParse(account).success).toBe(true);
  });

  it('rejects a blank name or malformed email', () => {
    expect(provisionAccountSchema.safeParse({ ...account, name: '  ' }).success).toBe(false);
    expect(provisionAccountSchema.safeParse({ ...account, email: 'not-an-email' }).success).toBe(
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
