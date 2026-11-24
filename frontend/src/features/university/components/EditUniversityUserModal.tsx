import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { AdminUserSummary, AdminUserUpdateRequest } from '@/api/identity';
import { Button, Field, Input, Modal, useToast } from '@/components/ui';
import type { DirectoryUser } from '@/features/directory/users';
import { normalizeError } from '@/lib/errors';
import { useUpdateUniversityUser } from '../hooks';
import {
  editUniversityUserSchema,
  type EditUniversityUserFormValues,
} from '../schemas';
import { S } from '../strings';

interface EditUniversityUserModalProps {
  user: AdminUserSummary | null;
  role: 'student' | 'supervisor';
  details?: DirectoryUser;
  onClose(): void;
}

const FIELD_ERRORS: Array<[string, keyof EditUniversityUserFormValues]> = [
  ['name', 'name'],
  ['email', 'email'],
  ['department', 'department'],
  ['specialty', 'specialty'],
  ['academic_year', 'academicYear'],
  ['matricule', 'matricule'],
];

/** Edit the profile fields a university admin is allowed to change for scoped users. */
export function EditUniversityUserModal({
  user,
  role,
  details,
  onClose,
}: EditUniversityUserModalProps) {
  const toast = useToast();
  const update = useUpdateUniversityUser();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<EditUniversityUserFormValues>({
    resolver: zodResolver(editUniversityUserSchema),
    values: user
      ? {
          name: user.name,
          email: user.email,
          department: details?.department ?? '',
          specialty: details?.specialty ?? '',
          academicYear: details?.academic_year ?? '',
          matricule: details?.matricule ?? '',
        }
      : undefined,
  });

  const close = () => {
    if (!update.isPending) onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    if (!user) return;
    const input: AdminUserUpdateRequest = {
      name: values.name,
      email: values.email,
      department: values.department,
    };
    if (role === 'student') {
      input.specialty = values.specialty;
      input.academic_year = values.academicYear;
      input.matricule = values.matricule;
    }
    try {
      await update.mutateAsync({ userId: user.id, input });
      toast.success(S.edit.saved);
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
      title={role === 'student' ? S.edit.studentTitle : S.edit.supervisorTitle}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={update.isPending}>
            {S.common.cancel}
          </Button>
          <Button
            type="submit"
            form="edit-university-user-form"
            isLoading={isSubmitting || update.isPending}
            disabled={!details}
          >
            {S.edit.save}
          </Button>
        </>
      }
    >
      <form id="edit-university-user-form" onSubmit={onSubmit} noValidate className="space-y-4">
        <Field label={S.edit.name} error={errors.name?.message}>
          <Input {...register('name')} hasError={!!errors.name} autoComplete="name" />
        </Field>
        <Field label={S.edit.email} error={errors.email?.message}>
          <Input
            {...register('email')}
            hasError={!!errors.email}
            type="email"
            autoComplete="email"
          />
        </Field>
        <Field label={S.edit.department} error={errors.department?.message}>
          <Input {...register('department')} hasError={!!errors.department} />
        </Field>
        {role === 'student' && (
          <>
            <Field label={S.edit.specialty} error={errors.specialty?.message}>
              <Input {...register('specialty')} hasError={!!errors.specialty} />
            </Field>
            <Field label={S.edit.academicYear} error={errors.academicYear?.message}>
              <Input {...register('academicYear')} hasError={!!errors.academicYear} />
            </Field>
            <Field label={S.edit.matricule} error={errors.matricule?.message}>
              <Input {...register('matricule')} hasError={!!errors.matricule} />
            </Field>
          </>
        )}
        {!details && (
          <p className="text-[12px] leading-4 text-muted">{S.edit.detailsUnavailable}</p>
        )}
      </form>
    </Modal>
  );
}
