import { z } from 'zod';
import { S } from './strings';

const requiredText = (max = 255) => z.string().trim().min(1, S.common.required).max(max);

export const accountSchema = z.object({
  name: z.string().trim().min(1, S.common.nameRequired).max(255),
  email: z.string().trim().min(1, S.common.emailRequired).email(S.common.emailInvalid),
});
export type AccountFormValues = z.infer<typeof accountSchema>;

// PUT /api/users/me/profile/ is a full replace: every field below is sent every time.
export const studentProfileSchema = accountSchema.extend({
  matricule: requiredText(128),
  university: requiredText(),
  department: requiredText(),
  specialty: requiredText(),
  academicYear: requiredText(64),
});
export type StudentProfileFormValues = z.infer<typeof studentProfileSchema>;

export const companyProfileSchema = z.object({
  companyName: z.string().trim().min(1, S.common.nameRequired).max(255),
  contactPerson: z.string().trim().max(255),
  location: z.string().trim(),
  website: z
    .string()
    .trim()
    .max(255)
    .refine((value) => value === '' || /^https?:\/\/\S+\.\S+/i.test(value), S.company.websiteInvalid),
  phone: z.string().trim().max(64),
  description: z.string().trim(),
});
export type CompanyProfileFormValues = z.infer<typeof companyProfileSchema>;

export const supervisorProfileSchema = accountSchema.extend({
  university: requiredText(),
  department: requiredText(),
  grade: requiredText(),
});
export type SupervisorProfileFormValues = z.infer<typeof supervisorProfileSchema>;
