import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/lib/auth/AuthContext';
import { ApiError } from '@/lib/api/client';
import { roleHome } from '@/lib/roles';
import { Button, Field, Input } from '@/components/ui';
import { AuthShell } from './AuthShell';

const schema = z.object({
  email: z.string().min(1, 'Enter your email').email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const from = (location.state as { from?: string } | null)?.from;

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      const user = await login(values.email, values.password);
      navigate(from ?? roleHome(user.role), { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 401) setFormError('Invalid email or password.');
        else if (error.status === 403)
          setFormError('This account is awaiting platform verification.');
        else if (error.status === 429)
          setFormError('Too many attempts. Please wait a moment and try again.');
        else setFormError(error.message);
      } else {
        setFormError('Unable to sign in right now. Please try again.');
      }
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to manage internships, applications and university placements."
      footer={
        <>
          New company?{' '}
          <Link to="/register/company" className="font-semibold text-forest-900 underline">
            Create an account
          </Link>
        </>
      }
    >
      <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field label="Email address" htmlFor="email" error={errors.email?.message} required>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            {...register('email')}
          />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message} required>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="Your password"
            {...register('password')}
          />
        </Field>

        {formError && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
            {formError}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Log in'}
        </Button>
      </form>

      <p className="mt-6 text-center text-xs leading-relaxed text-muted">
        Students, supervisors and university administrators receive accounts from their
        institution.
      </p>
    </AuthShell>
  );
}
