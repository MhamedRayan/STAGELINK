import { z } from 'zod';
import { PW } from './passwordStrings';

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, PW.modal.currentRequired),
    newPassword: z.string().min(8, PW.modal.nextMin),
    confirmPassword: z.string().min(1, PW.modal.confirmRequired),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: PW.modal.mismatch,
  });
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
