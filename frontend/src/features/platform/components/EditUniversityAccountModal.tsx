import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { AdminUserSummary, AdminUserUpdateRequest } from '@/api/identity';
import { Button, Field, Input, Modal, useToast } from '@/components/ui';
import { normalizeError } from '@/lib/errors';
import { useUpdateUniversityAccount } from '../hooks';
import {
  editUniversityAccountSchema,
  type EditUniversityAccountFormValues,
} from '../schemas';
import { S } from '../strings';

interface EditUniversityAccountModalProps {
  user: AdminUserSummary | null;
  onClose(): void;
}

const FIELD_ERRORS: Array<[string, keyof EditUniversityAccountFormValues]> = [
  ['name', 'name'],
  ['university', 'university'],
];

/** Edit the display name and scoping institution of a university account. */
export function EditUniversityAccountModal({ user, onClose }: EditUniversityAccountModalProps) {
  const toast = useToast();
  const update = useUpdateUniversityAccount();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<EditUniversityAccountFormValues>({
    resolver: zodResolver(editUniversityAccountSchema),
    values: user ? { name: user.name, university: user.university ?? '' } : undefined,
  });

  const close = () => {
    if (!update.isPending) onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    if (!user) return;
    const input: AdminUserUpdateRequest = {
      name: values.name,
      university: values.university,
    };
    try {
      await update.mutateAsync({ userId: user.id, input });
      toast.success(S.universities.saved);
      onClose();
    } catch (error) {
      const apiError = normalizeError(error);
      let fieldShown = false;
      for (const [apiField, formField] of FIELD_ERRORS) {
        const message = apiError.fieldErrors[apiField];
        if (message) {
          setError(formField, { message });
          fieldShown = true;
        }
      }
      if (!fieldShown) toast.error(apiError.message);
    }
  });

  return (
    <Modal
      open={Boolean(user)}
      onClose={close}
      title={S.universities.editTitle}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={update.isPending}>
            {S.common.cancel}
          </Button>
          <Button
            type="submit"
            form="edit-university-account-form"
            isLoading={isSubmitting || update.isPending}
          >
            {S.common.edit}
          </Button>
        </>
      }
    >
      <p className="mb-4 text-[12px] leading-4 text-muted">{S.universities.editHint}</p>
      <form id="edit-university-account-form" onSubmit={onSubmit} noValidate className="space-y-4">
        <Field label={S.universities.editName} error={errors.name?.message}>
          <Input {...register('name')} hasError={!!errors.name} autoComplete="organization" />
        </Field>
        <Field label={S.universities.editInstitution} error={errors.university?.message}>
          <Input {...register('university')} hasError={!!errors.university} />
        </Field>
      </form>
    </Modal>
  );
}
