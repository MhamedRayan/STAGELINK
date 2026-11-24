import { z } from 'zod';
import { S } from './strings';

/** One provisioning card. The API needs either a password or `generate_password: true`. */
export const provisionAccountSchema = z
  .object({
    name: z.string().trim().min(1, S.accounts.nameRequired).max(255),
    email: z
      .string()
      .trim()
      .min(1, S.accounts.emailRequired)
      .max(254)
      .email(S.accounts.emailInvalid),
    generatePassword: z.boolean(),
    password: z.string().max(128),
    role: z.enum(['company', 'university_admin']),
    university: z.string().trim().max(255),
  })
  .superRefine((values, ctx) => {
    if (!values.generatePassword && values.password.length < 8) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['password'],
        message: S.accounts.passwordMin,
      });
    }
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
