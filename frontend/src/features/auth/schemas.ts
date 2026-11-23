import { z } from 'zod';
import { S } from './strings';

export const loginSchema = z.object({
  email: z.string().trim().min(1, S.login.emailRequired).email(S.login.emailInvalid),
  password: z.string().min(1, S.login.passwordRequired),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

// Only name, email and password are sent: POST /api/auth/register/ accepts nothing else yet.
// Legal form, location, registration number and phone are collected by the form (Figma 62:4)
// but are optional and NOT stored by the backend until it supports them.
export const registerCompanySchema = z
  .object({
    name: z.string().trim().min(1, S.register.nameRequired).max(255),
    legalForm: z.string().trim().max(100),
    location: z.string().trim().max(255),
    registrationNumber: z.string().trim().max(100),
    phone: z.string().trim().max(30),
    email: z.string().trim().min(1, S.login.emailRequired).email(S.login.emailInvalid),
    password: z.string().min(8, S.register.passwordMin),
    confirmPassword: z.string().min(1, S.register.confirmRequired),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: S.register.passwordMismatch,
  });
export type RegisterCompanyFormValues = z.infer<typeof registerCompanySchema>;
