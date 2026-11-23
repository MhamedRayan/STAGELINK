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
  })
  .refine((values) => values.generatePassword || values.password.length >= 8, {
    path: ['password'],
    message: S.accounts.passwordMin,
  });

export type ProvisionAccountFormValues = z.infer<typeof provisionAccountSchema>;

export const rejectCompanySchema = z.object({
  reason: z.string().trim().min(1, 'A reason is required.'),
});

export type RejectCompanyFormValues = z.infer<typeof rejectCompanySchema>;
