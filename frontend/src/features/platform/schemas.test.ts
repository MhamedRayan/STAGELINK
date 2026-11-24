import { editUniversityAccountSchema, provisionAccountSchema } from './schemas';

const base = {
  name: 'University of Algiers',
  email: 'contact@univ.dz',
  password: 'longenough1',
  role: 'university_admin' as const,
  university: 'University of Algiers',
};

describe('platform schemas', () => {
  it('requires an initial password of at least 8 characters', () => {
    expect(provisionAccountSchema.safeParse({ ...base, password: '' }).success).toBe(false);
    expect(provisionAccountSchema.safeParse({ ...base, password: 'short' }).success).toBe(false);
    expect(provisionAccountSchema.safeParse(base).success).toBe(true);
  });

  it('requires an institution for university accounts but not for companies', () => {
    expect(provisionAccountSchema.safeParse({ ...base, university: '' }).success).toBe(false);
    expect(
      provisionAccountSchema.safeParse({
        ...base,
        role: 'company',
        university: '',
        email: 'contact@company.dz',
      }).success,
    ).toBe(true);
  });

  it('rejects a missing name or a malformed email', () => {
    expect(provisionAccountSchema.safeParse({ ...base, name: '  ' }).success).toBe(false);
    expect(provisionAccountSchema.safeParse({ ...base, email: 'not-an-email' }).success).toBe(false);
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
