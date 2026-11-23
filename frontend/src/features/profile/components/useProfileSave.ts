import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { useToast } from '@/components/ui/Toast';
import { normalizeError } from '@/lib/errors';
import { S } from '../strings';

/** Shared success/error handling: toast on success, map server field errors, else toast the message. */
export function useSaveFeedback<T extends FieldValues>(setError: UseFormSetError<T>, fieldMap: Record<string, Path<T>>) {
  const toast = useToast();
  return {
    onSaved: () => toast.success(S.common.saved),
    onFailed: (error: unknown) => {
      const apiError = normalizeError(error);
      let mapped = false;
      for (const [serverField, formField] of Object.entries(fieldMap)) {
        const message = apiError.fieldErrors[serverField];
        if (message) {
          setError(formField, { message });
          mapped = true;
        }
      }
      if (!mapped) toast.error(apiError.message || S.common.saveFailed);
    },
  };
}
