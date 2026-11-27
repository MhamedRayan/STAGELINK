import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { AdminUserUpdateRequest } from '@/api/identity';
import { Button, Field, Input, Modal, PasswordInput, useToast } from '@/components/ui';
import { normalizeError } from '@/lib/errors';
import { isUniversityScopeError, useProvisionUniversityUser } from '../hooks';
import {
  provisionAccountSchema,
  type ProvisionAccountFormValues,
} from '../schemas';
import { S } from '../strings';

interface ProvisionAccountModalProps {
  open: boolean;
  role: 'student' | 'supervisor';
  onClose(): void;
}

const DEFAULTS = (role: ProvisionAccountModalProps['role']): ProvisionAccountFormValues => ({
  name: '',
  email: '',
  password: '',
  role,
  matricule: '',
  department: '',
  specialty: '',
  academicYear: '',
  grade: '',
});

/** University-admin account creation with all academic profile fields. */
export function ProvisionAccountModal({ open, role, onClose }: ProvisionAccountModalProps) {
  const toast = useToast();
  const create = useProvisionUniversityUser();
  const [scopeError, setScopeError] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProvisionAccountFormValues>({
    resolver: zodResolver(provisionAccountSchema),
    defaultValues: DEFAULTS(role),
  });

  useEffect(() => {
    if (!open) return;
    setScopeError(false);
    reset(DEFAULTS(role));
  }, [open, reset, role]);

  const close = () => {
    if (!create.isPending) onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    const profile: AdminUserUpdateRequest =
      role === 'student'
        ? {
            matricule: values.matricule,
            department: values.department,
            specialty: values.specialty,
            academic_year: values.academicYear,
          }
        : {
            department: values.department,
            grade: values.grade,
          };
    try {
      const result = await create.mutateAsync({
        create: {
          name: values.name,
          email: values.email,
          role,
          password: values.password,
          generate_password: false,
        },
        profile,
      });
      setScopeError(false);
      if (result.profileSaved) toast.success(S.provision.created);
      else toast.error(S.provision.profileIncomplete);
      onClose();
    } catch (error) {
      const apiError = normalizeError(error);
      setScopeError(isUniversityScopeError(error));
      let fieldShown = false;
      for (const field of ['name', 'email', 'password'] as const) {
        const message = apiError.fieldErrors[field];
        if (message) {
          setError(field, { message });
          fieldShown = true;
        }
      }
      if (!fieldShown) toast.error(apiError.message);
    }
  });

  return (
    <Modal
      open={open}
      onClose={close}
      title={role === 'student' ? S.provision.studentTitle : S.provision.supervisorTitle}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={create.isPending}>
            {S.common.cancel}
          </Button>
          <Button
            type="submit"
            form="provision-account-form"
            isLoading={isSubmitting || create.isPending}
          >
            {role === 'student' ? S.provision.studentSubmit : S.provision.supervisorSubmit}
          </Button>
        </>
      }
    >
      <form
        id="provision-account-form"
        onSubmit={onSubmit}
        noValidate
        autoComplete="off"
        className="space-y-4"
      >
        {scopeError && (
          <p
            role="alert"
            className="rounded-card border border-pill-danger-fg bg-pill-danger-bg px-3 py-2 text-[12px] leading-4 text-pill-danger-fg"
          >
            {S.common.universityScopeHint}
          </p>
        )}
        <p className="rounded-card border border-line bg-mint px-3 py-2 text-[12px] leading-4 text-muted">
          {S.provision.institutionNote}
        </p>
        <Field label={S.provision.name} error={errors.name?.message}>
          <Input {...register('name')} hasError={!!errors.name} autoComplete="name" />
        </Field>
        <Field label={S.provision.email} error={errors.email?.message}>
          <Input
            {...register('email')}
            hasError={!!errors.email}
            type="email"
            autoComplete="email"
          />
        </Field>
        {role === 'student' ? (
          <>
            <Field label={S.edit.matricule} error={errors.matricule?.message}>
              <Input {...register('matricule')} hasError={!!errors.matricule} />
            </Field>
            <Field label={S.edit.department} error={errors.department?.message}>
              <Input {...register('department')} hasError={!!errors.department} />
            </Field>
            <Field label={S.edit.specialty} error={errors.specialty?.message}>
              <Input {...register('specialty')} hasError={!!errors.specialty} />
            </Field>
            <Field label={S.edit.academicYear} error={errors.academicYear?.message}>
              <Input {...register('academicYear')} hasError={!!errors.academicYear} />
            </Field>
          </>
        ) : (
          <>
            <Field label={S.edit.department} error={errors.department?.message}>
              <Input {...register('department')} hasError={!!errors.department} />
            </Field>
            <Field label={S.provision.grade} error={errors.grade?.message}>
              <Input {...register('grade')} hasError={!!errors.grade} />
            </Field>
          </>
        )}
        <Field label={S.provision.password} error={errors.password?.message}>
          <PasswordInput
            {...register('password')}
            hasError={!!errors.password}
            id={`provision-password-${role}`}
            autoComplete="off"
            showLabel={S.common.showPassword}
            hideLabel={S.common.hidePassword}
          />
        </Field>
      </form>
    </Modal>
  );
}
