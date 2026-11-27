import { z } from 'zod';
import { S } from './strings';

export const loginSchema = z.object({
  email: z.string().trim().min(1, S.login.emailRequired).email(S.login.emailInvalid),
  password: z.string().min(1, S.login.passwordRequired),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

// Every field on the Figma 62:4 form is sent: the registration endpoint stores the
// company details on the profile so the platform administrator can verify them.
export const registerCompanySchema = z
  .object({
    name: z.string().trim().min(1, S.register.nameRequired).max(255),
    legalForm: z.string().trim().min(1, S.register.legalFormRequired).max(100),
    location: z.string().trim().min(1, S.register.locationRequired).max(255),
    registrationNumber: z
      .string()
      .trim()
      .min(1, S.register.registrationNumberRequired)
      .max(100),
    phone: z.string().trim().min(1, S.register.phoneRequired).max(64),
    email: z.string().trim().min(1, S.login.emailRequired).email(S.login.emailInvalid),
    password: z.string().min(8, S.register.passwordMin),
    confirmPassword: z.string().min(1, S.register.confirmRequired),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: S.register.passwordMismatch,
  });
export type RegisterCompanyFormValues = z.infer<typeof registerCompanySchema>;
