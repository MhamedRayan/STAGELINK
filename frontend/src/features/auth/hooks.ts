import { useMutation } from '@tanstack/react-query';
import { registerCompany } from '@/api/identity';

export function useRegisterCompany() {
  return useMutation({ mutationFn: registerCompany });
}
