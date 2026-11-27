import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Logo } from '@/components/ui/Logo';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { normalizeError } from '@/lib/errors';
import { useAuth } from '../AuthProvider';
import { loginSchema, type LoginFormValues } from '../schemas';
import { S } from '../strings';

function loginErrorMessage(error: unknown): string {
  const apiError = normalizeError(error);
  if (apiError.status === 401) return S.login.invalidCredentials;
  if (apiError.status === 403) return S.login.awaitingVerification;
  return apiError.message;
}

/** Login — Figma frame 24:3. Card 500×600 on canvas, content column 420 px (40 px side padding). */
export function AuthLoginPage() {
  const { login } = useAuth();
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  // One message slot next to "Forgot password?" so the card layout never shifts.
  const message = errors.email?.message ?? errors.password?.message ?? serverMessage;

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setServerMessage(null);
    try {
      await login(email, password); // PublicOnly then redirects to the role's dashboard
    } catch (error) {
      setServerMessage(loginErrorMessage(error));
    }
  });

  return (
    <main className="relative flex min-h-screen items-start justify-center bg-canvas p-4 pb-16 sm:items-center sm:p-6">
      <Link
        to={ROUTES.guest.offers}
        className="absolute left-4 top-4 inline-flex items-center gap-2 text-[13px] font-medium text-surface-600 hover:underline sm:left-10 sm:top-8"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {S.login.browseOffers}
      </Link>
      <div className="relative flex min-h-[600px] w-full max-w-[500px] flex-col rounded-[20px] border border-line bg-mint px-5 pb-8 pt-20 sm:px-10 sm:pt-9">
        <div className="flex justify-center">
          <Logo size="md" />
        </div>

        <h1 className="mt-[23px] text-center text-[26px] font-bold leading-[31px] text-forest-900">
          {S.login.title}
        </h1>
        <p className="mt-[3px] text-center text-[12px] leading-[15px] text-muted">
          {S.login.subtitle}
        </p>

        <form onSubmit={onSubmit} noValidate>
          <Field label={S.login.emailLabel} className="mt-[31px]">
            <Input
              type="email"
              autoComplete="email"
              placeholder={S.login.emailPlaceholder}
              hasError={Boolean(errors.email)}
              {...register('email')}
            />
          </Field>

          <Field label={S.login.passwordLabel} className="mt-5">
            <PasswordInput
              autoComplete="current-password"
              placeholder={S.login.passwordPlaceholder}
              hasError={Boolean(errors.password)}
              showLabel={S.passwordToggle.show}
              hideLabel={S.passwordToggle.hide}
              {...register('password')}
            />
          </Field>

          <div className="mt-1.5 flex min-h-[15px] items-start justify-between gap-4">
            <p role="alert" className="text-[12px] leading-[15px] text-pill-danger-fg">
              {message}
            </p>
            <button
              type="button"
              onClick={() => setServerMessage(S.login.forgotUnavailable)}
              className="shrink-0 text-[12px] font-medium leading-[15px] text-surface-600 hover:underline"
            >
              {S.login.forgot}
            </button>
          </div>

          <Button type="submit" size="lg" isLoading={isSubmitting} className="mt-[17px] w-full">
            {S.login.submit}
          </Button>
        </form>

        <p className="mt-auto pt-8 text-[12px] leading-[15px] text-muted">{S.login.note}</p>

        <Link
          to={ROUTES.registerCompany}
          className="mt-2 inline-block text-[13px] font-medium leading-4 text-surface-600 hover:underline"
        >
          {S.login.newCompany}
        </Link>
      </div>
    </main>
  );
}
