import { editUniversityUserSchema, provisionAccountSchema } from './schemas';

const account = {
  name: 'Amina Njeri',
  email: 'amina@example.com',
  generatePassword: false,
  password: '',
};

describe('university schemas', () => {
  it('requires a password of at least 8 characters unless one is generated', () => {
    expect(provisionAccountSchema.safeParse(account).success).toBe(false);
    expect(provisionAccountSchema.safeParse({ ...account, password: 'short' }).success).toBe(false);
    expect(provisionAccountSchema.safeParse({ ...account, password: 'longenough1' }).success).toBe(
      true,
    );
    expect(provisionAccountSchema.safeParse({ ...account, generatePassword: true }).success).toBe(
      true,
    );
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
