import { useMutation } from '@tanstack/react-query';
import { changePassword } from '@/api/identity';

export function useChangePassword() {
  return useMutation({
    mutationFn: (values: { currentPassword: string; newPassword: string }) =>
      changePassword(values.currentPassword, values.newPassword),
  });
}
