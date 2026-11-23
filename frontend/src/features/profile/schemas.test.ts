import { changePasswordSchema } from '@/features/auth/passwordSchema';
import { companyProfileSchema } from './schemas';

describe('profile schemas', () => {
  it('rejects mismatching new passwords and short passwords', () => {
    const mismatch = changePasswordSchema.safeParse({ currentPassword: 'a', newPassword: 'longenough1', confirmPassword: 'other' });
    expect(mismatch.success).toBe(false);
    const short = changePasswordSchema.safeParse({ currentPassword: 'a', newPassword: 'short', confirmPassword: 'short' });
    expect(short.success).toBe(false);
    const ok = changePasswordSchema.safeParse({ currentPassword: 'a', newPassword: 'longenough1', confirmPassword: 'longenough1' });
    expect(ok.success).toBe(true);
  });
  it('accepts an empty or valid website, rejects junk', () => {
    const base = { companyName: 'ACME', contactPerson: '', location: '', phone: '', description: '' };
    expect(companyProfileSchema.safeParse({ ...base, website: '' }).success).toBe(true);
    expect(companyProfileSchema.safeParse({ ...base, website: 'https://acme.dz' }).success).toBe(true);
    expect(companyProfileSchema.safeParse({ ...base, website: 'acme' }).success).toBe(false);
  });
});
