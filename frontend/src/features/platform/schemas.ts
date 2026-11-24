import { z } from 'zod';
import { S } from './strings';

/** One provisioning card: an explicit initial password is always required. */
export const provisionAccountSchema = z
  .object({
    name: z.string().trim().min(1, S.accounts.nameRequired).max(255),
    email: z
      .string()
      .trim()
      .min(1, S.accounts.emailRequired)
      .max(254)
      .email(S.accounts.emailInvalid),
    password: z.string().min(8, S.accounts.passwordMin).max(128),
    role: z.enum(['company', 'university_admin']),
    university: z.string().trim().max(255),
  })
  .superRefine((values, ctx) => {
    if (values.role === 'university_admin' && !values.university) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['university'],
        message: S.universities.institutionRequired,
      });
    }
  });

export type ProvisionAccountFormValues = z.infer<typeof provisionAccountSchema>;

/** Platform edit of an existing university account's display name and scoping institution. */
export const editUniversityAccountSchema = z.object({
  name: z.string().trim().min(1, S.accounts.nameRequired).max(255),
  university: z.string().trim().min(1, S.universities.institutionRequired).max(255),
});
export type EditUniversityAccountFormValues = z.infer<typeof editUniversityAccountSchema>;

export const rejectCompanySchema = z.object({
  reason: z.string().trim().min(1, 'A reason is required.'),
});

export type RejectCompanyFormValues = z.infer<typeof rejectCompanySchema>;
