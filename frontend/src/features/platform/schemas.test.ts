import { editUniversityAccountSchema, provisionAccountSchema } from './schemas';

const base = {
  name: 'University of Algiers',
  email: 'contact@univ.dz',
  generatePassword: false,
  password: '',
  role: 'university_admin' as const,
  university: 'University of Algiers',
};

describe('platform schemas', () => {
  it('requires a password of at least 8 characters when none is generated', () => {
    expect(provisionAccountSchema.safeParse(base).success).toBe(false);
    expect(provisionAccountSchema.safeParse({ ...base, password: 'short' }).success).toBe(false);
    expect(provisionAccountSchema.safeParse({ ...base, password: 'longenough1' }).success).toBe(true);
  });

  it('accepts an empty password when one is generated', () => {
    expect(provisionAccountSchema.safeParse({ ...base, generatePassword: true }).success).toBe(true);
  });

  it('rejects a missing name or a malformed email', () => {
    expect(provisionAccountSchema.safeParse({ ...base, name: '  ' }).success).toBe(false);
    expect(provisionAccountSchema.safeParse({ ...base, email: 'not-an-email' }).success).toBe(false);
  });

  it('requires an institution for university accounts but not for companies', () => {
    expect(provisionAccountSchema.safeParse({ ...base, university: '' }).success).toBe(false);
    expect(
      provisionAccountSchema.safeParse({
        ...base,
        role: 'company',
        university: '',
        generatePassword: true,
      }).success,
    ).toBe(true);
  });

  it('requires both a name and an institution when editing a university account', () => {
    expect(
      editUniversityAccountSchema.safeParse({ name: 'University of Algiers', university: '  ' })
        .success,
    ).toBe(false);
    expect(
      editUniversityAccountSchema.safeParse({ name: '  ', university: 'University of Algiers' })
        .success,
    ).toBe(false);
    expect(
      editUniversityAccountSchema.safeParse({
        name: 'University of Algiers',
        university: 'University of Algiers',
      }).success,
    ).toBe(true);
  });
});
