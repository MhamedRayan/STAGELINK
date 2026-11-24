import { z } from 'zod';
import { S } from './strings';

const requiredText = (max = 255) => z.string().trim().min(1, S.common.required).max(max);
const optionalText = (max = 255) => z.string().trim().max(max);

const email = z
  .string()
  .trim()
  .min(1, S.common.emailRequired)
  .max(254)
  .email(S.common.emailInvalid);

export const provisionAccountSchema = z.object({
  name: requiredText(),
  email,
  password: z.string().min(8, S.common.passwordMin).max(128),
});

export type ProvisionAccountFormValues = z.infer<typeof provisionAccountSchema>;

export const editUniversityUserSchema = z.object({
  name: requiredText(),
  email,
  department: optionalText(),
  specialty: optionalText(),
  academicYear: optionalText(64),
  matricule: optionalText(128),
});

export type EditUniversityUserFormValues = z.infer<typeof editUniversityUserSchema>;
