import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Logo } from '@/components/ui/Logo';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { normalizeError } from '@/lib/errors';
import { useRegisterCompany } from '../hooks';
import { registerCompanySchema, type RegisterCompanyFormValues } from '../schemas';
import { S } from '../strings';

const SERVER_FIELDS = ['name', 'email', 'password'] as const;

/**
 * Company Register — Figma 62:4: 840 px card, 4 rows × 2 columns.
 * Only name/email/password are sent (the API accepts nothing else yet); the other four fields
 * are shown as designed and are not persisted — see schemas.ts.
 */
export function AuthCompanyRegisterPage() {
  const navigate = useNavigate();
  const registerMutation = useRegisterCompany();
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterCompanyFormValues>({
    resolver: zodResolver(registerCompanySchema),
    defaultValues: {
      name: '',
      legalForm: '',
      location: '',
      registrationNumber: '',
      phone: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = handleSubmit(async ({ name, email, password }) => {
    setServerMessage(null);
    try {
      await registerMutation.mutateAsync({ name, email, password });
      navigate(ROUTES.registerSubmitted, { replace: true });
    } catch (error) {
      const apiError = normalizeError(error);
      if (apiError.status === 429) {
        setServerMessage(S.register.tooManyAttempts);
        return;
      }
      let mapped = false;
      for (const field of SERVER_FIELDS) {
        const message = apiError.fieldErrors[field];
        if (message) {
          setError(field, { message });
          mapped = true;
        }
      }
      if (!mapped) setServerMessage(apiError.message);
    }
  });

  return (
    <main className="flex min-h-screen items-start justify-center bg-canvas p-4 pb-12 sm:items-center sm:p-6">
      <div className="w-full max-w-[840px] rounded-[20px] border border-line bg-mint px-5 pb-10 pt-8 sm:px-10 sm:pb-16 sm:pt-[54px] lg:px-20 lg:pb-[127px]">
        <div className="flex justify-center">
          <Logo size="md" />
        </div>
        <h1 className="mt-4 text-center text-[20px] font-bold leading-6 text-forest-900">
          {S.register.title}
        </h1>
        <p className="mt-1.5 text-center text-[12px] leading-4 text-muted">{S.register.subtitle}</p>

        <form onSubmit={onSubmit} noValidate>
          <div className="mt-[18px] grid grid-cols-1 gap-x-10 gap-y-[14px] sm:grid-cols-2">
            <Field label={S.register.nameLabel} controlGap="md" error={errors.name?.message}>
              <Input
                className="h-10 rounded-[8px] text-[13px]"
                autoComplete="organization"
                placeholder={S.register.namePlaceholder}
                hasError={Boolean(errors.name)}
                {...register('name')}
              />
            </Field>
            <Field label={S.register.legalFormLabel} controlGap="md" error={errors.legalForm?.message}>
              <Input
                className="h-10 rounded-[8px] text-[13px]"
                placeholder={S.register.legalFormPlaceholder}
                hasError={Boolean(errors.legalForm)}
                {...register('legalForm')}
              />
            </Field>
            <Field label={S.register.locationLabel} controlGap="md" error={errors.location?.message}>
              <Input
                className="h-10 rounded-[8px] text-[13px]"
                autoComplete="address-level2"
                placeholder={S.register.locationPlaceholder}
                hasError={Boolean(errors.location)}
                {...register('location')}
              />
            </Field>
            <Field
              label={S.register.registrationNumberLabel}
              controlGap="md"
              error={errors.registrationNumber?.message}
            >
              <Input
                className="h-10 rounded-[8px] text-[13px]"
                placeholder={S.register.registrationNumberPlaceholder}
                hasError={Boolean(errors.registrationNumber)}
                {...register('registrationNumber')}
              />
            </Field>
            <Field label={S.register.emailLabel} controlGap="md" error={errors.email?.message}>
              <Input
                type="email"
                className="h-10 rounded-[8px] text-[13px]"
                autoComplete="email"
                placeholder={S.register.emailPlaceholder}
                hasError={Boolean(errors.email)}
                {...register('email')}
              />
            </Field>
            <Field label={S.register.phoneLabel} controlGap="md" error={errors.phone?.message}>
              <Input
                type="tel"
                className="h-10 rounded-[8px] text-[13px]"
                autoComplete="tel"
                placeholder={S.register.phonePlaceholder}
                hasError={Boolean(errors.phone)}
                {...register('phone')}
              />
            </Field>
            <Field label={S.register.passwordLabel} controlGap="md" error={errors.password?.message}>
              <PasswordInput
                className="h-10 rounded-[8px] text-[13px]"
                autoComplete="new-password"
                placeholder={S.register.passwordPlaceholder}
                hasError={Boolean(errors.password)}
                showLabel={S.passwordToggle.show}
                hideLabel={S.passwordToggle.hide}
                {...register('password')}
              />
            </Field>
            <Field
              label={S.register.confirmLabel}
              controlGap="md"
              error={errors.confirmPassword?.message}
            >
              <PasswordInput
                className="h-10 rounded-[8px] text-[13px]"
                autoComplete="new-password"
                placeholder={S.register.passwordPlaceholder}
                hasError={Boolean(errors.confirmPassword)}
                showLabel={S.passwordToggle.show}
                hideLabel={S.passwordToggle.hide}
                {...register('confirmPassword')}
              />
            </Field>
          </div>

          {/* 38 px gap from the frame; also holds a server-side message without shifting the card */}
          <div className="flex h-[38px] items-center justify-center">
            <p role="alert" className="text-center text-[12px] leading-4 text-pill-danger-fg">
              {serverMessage}
            </p>
          </div>

          <Button
            type="submit"
            isLoading={isSubmitting}
            className="mx-auto flex h-11 w-full max-w-[360px] rounded-xl text-[14px] font-medium"
          >
            {S.register.submit}
          </Button>
        </form>

        <Link
          to={ROUTES.login}
          className="mt-[22px] block text-center text-[13px] font-medium leading-4 text-surface-600 hover:underline"
        >
          {S.register.backToLogin}
        </Link>
      </div>
    </main>
  );
}
