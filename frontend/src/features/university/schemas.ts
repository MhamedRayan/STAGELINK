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

/** University-admin creation captures every profile field at signup time. */
export const provisionAccountSchema = z
  .object({
    name: requiredText(),
    email,
    password: z.string().min(8, S.common.passwordMin).max(128),
    role: z.enum(['student', 'supervisor']),
    matricule: optionalText(128),
    department: optionalText(),
    specialty: optionalText(),
    academicYear: optionalText(64),
    grade: optionalText(),
  })
  .superRefine((values, ctx) => {
    if (!values.department) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['department'],
        message: S.common.required,
      });
    }
    if (values.role === 'student') {
      for (const field of ['matricule', 'specialty', 'academicYear'] as const) {
        if (!values[field]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field],
            message: S.common.required,
          });
        }
      }
    }
    if (values.role === 'supervisor' && !values.grade) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['grade'],
        message: S.common.required,
      });
    }
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
