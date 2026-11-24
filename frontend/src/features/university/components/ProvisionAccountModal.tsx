import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { AdminUserCreateResponse } from '@/api/identity';
import { Button, Field, Input, Modal, useToast } from '@/components/ui';
import { normalizeError } from '@/lib/errors';
import { useProvisionUniversityUser } from '../hooks';
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
  generatePassword: true,
  password: '',
};

/** University-admin account creation. The backend inherits the caller's university. */
export function ProvisionAccountModal({ open, role, onClose }: ProvisionAccountModalProps) {
  const toast = useToast();
  const create = useProvisionUniversityUser();
  const [created, setCreated] = useState<AdminUserCreateResponse | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProvisionAccountFormValues>({
    resolver: zodResolver(provisionAccountSchema),
    defaultValues: DEFAULTS,
  });
  const generatePassword = watch('generatePassword');

  useEffect(() => {
    if (!open) return;
    setCreated(null);
    reset(DEFAULTS);
  }, [open, reset]);

  const close = () => {
    if (!create.isPending) onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      const result = await create.mutateAsync({
        name: values.name,
        email: values.email,
        role,
        generate_password: values.generatePassword,
        ...(values.generatePassword ? {} : { password: values.password }),
      });
      toast.success(S.provision.created);
      setCreated(result);
    } catch (error) {
      const apiError = normalizeError(error);
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

  const copyPassword = async () => {
    if (!created?.one_time_password) return;
    try {
      await navigator.clipboard.writeText(created.one_time_password);
      toast.success(S.provision.copied);
    } catch {
      toast.error(S.provision.oneTimeNote);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={
        created
          ? S.provision.oneTimeTitle
          : role === 'student'
            ? S.provision.studentTitle
            : S.provision.supervisorTitle
      }
      footer={
        created ? (
          <Button variant="secondary" onClick={close}>
            {S.provision.close}
          </Button>
        ) : (
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
        )
      }
    >
      {created ? (
        <div>
          {created.one_time_password ? (
            <>
              <p className="text-[13px] text-muted">{S.provision.oneTimeNote}</p>
              <p className="mt-4 break-all rounded-[8px] border border-line bg-canvas p-3 text-[16px] font-semibold text-forest-900">
                {created.one_time_password}
              </p>
              <Button variant="secondary" className="mt-4" onClick={() => void copyPassword()}>
                {S.provision.copy}
              </Button>
            </>
          ) : (
            <p className="text-[13px] text-ink">{S.provision.created}</p>
          )}
        </div>
      ) : (
        <form id="provision-account-form" onSubmit={onSubmit} noValidate className="space-y-4">
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
              disabled={generatePassword}
            />
          </Field>
          <label className="flex h-10 cursor-pointer items-center gap-3 rounded-[8px] border border-line bg-canvas px-[14px] text-[13px] text-forest-900">
            <input
              {...register('generatePassword')}
              type="checkbox"
              className="h-4 w-4 accent-surface-600"
            />
            {S.provision.generatePassword}
          </label>
        </form>
      )}
    </Modal>
  );
}
