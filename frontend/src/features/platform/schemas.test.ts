import { provisionAccountSchema } from './schemas';

const base = {
  name: 'University of Algiers',
  email: 'contact@univ.dz',
  generatePassword: false,
  password: '',
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
});
