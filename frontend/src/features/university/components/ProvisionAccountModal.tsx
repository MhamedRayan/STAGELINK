import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button, Field, Input, Modal, useToast } from '@/components/ui';
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

const DEFAULTS: ProvisionAccountFormValues = {
  name: '',
  email: '',
  password: '',
};

/** University-admin account creation with an explicit initial password. */
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
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (!open) return;
    setScopeError(false);
    reset(DEFAULTS);
  }, [open, reset]);

  const close = () => {
    if (!create.isPending) onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      await create.mutateAsync({
        name: values.name,
        email: values.email,
        role,
        password: values.password,
        generate_password: false,
      });
      toast.success(S.provision.created);
      setScopeError(false);
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
      <form id="provision-account-form" onSubmit={onSubmit} noValidate className="space-y-4">
        {scopeError && (
          <p
            role="alert"
            className="rounded-card border border-pill-danger-fg bg-pill-danger-bg px-3 py-2 text-[12px] leading-4 text-pill-danger-fg"
          >
            {S.common.universityScopeHint}
          </p>
        )}
        <Field label={S.provision.name} error={errors.name?.message}>
          <Input
            {...register('name')}
            hasError={!!errors.name}
            autoComplete="name"
          />
        </Field>
        <Field label={S.provision.email} error={errors.email?.message}>
          <Input
            {...register('email')}
            hasError={!!errors.email}
            type="email"
            autoComplete="email"
          />
        </Field>
        <Field label={S.provision.password} error={errors.password?.message}>
          <Input
            {...register('password')}
            hasError={!!errors.password}
            type="password"
            autoComplete="new-password"
          />
        </Field>
      </form>
    </Modal>
  );
}
