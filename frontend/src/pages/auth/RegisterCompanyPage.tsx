import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { identityApi } from '@/lib/api/identity';
import { ApiError } from '@/lib/api/client';
import { Button, Field, Input } from '@/components/ui';
import { AuthShell } from './AuthShell';

const schema = z
  .object({
    name: z.string().min(2, 'Enter the company name').max(200, 'Company name is too long'),
    email: z.string().min(1, 'Enter an email address').email('Enter a valid email address'),
    password: z.string().min(8, 'Use at least 8 characters').max(128, 'Password is too long'),
    confirmPassword: z.string().min(1, 'Confirm the password'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

type FormValues = z.infer<typeof schema>;

export function RegisterCompanyPage() {
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      await identityApi.register({
        name: values.name,
        email: values.email,
        password: values.password,
        role: 'company',
      });
      navigate('/register/submitted', { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.fields) {
          for (const [field, message] of Object.entries(error.fields)) {
            if (field === 'email' || field === 'name' || field === 'password') {
              setError(field, { message });
            }
          }
        }
        setFormError(
          error.status === 429
            ? 'Too many registration attempts. Please try again later.'
            : error.message,
        );
      } else {
        setFormError('Unable to create the account right now. Please try again.');
      }
    }
  }

  return (
    <AuthShell
      wide
      title="Create a company account"
      subtitle="Register your company to publish internship offers. A platform administrator verifies every company before the account becomes active."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-forest-900 underline">
            Back to log in
          </Link>
        </>
      }
    >
      <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="grid grid-cols-2 gap-5">
          <div className="col-span-2">
            <Field label="Company name" htmlFor="name" error={errors.name?.message} required>
              <Input id="name" placeholder="ABC Company" {...register('name')} />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Email address" htmlFor="email" error={errors.email?.message} required>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="contact@company.com"
                {...register('email')}
              />
            </Field>
          </div>
          <Field label="Password" htmlFor="password" error={errors.password?.message} required>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              {...register('password')}
            />
          </Field>
          <Field
            label="Confirm password"
            htmlFor="confirmPassword"
            error={errors.confirmPassword?.message}
            required
          >
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Repeat the password"
              {...register('confirmPassword')}
            />
          </Field>
        </div>

        <p className="rounded-lg bg-mint px-4 py-3 text-xs leading-relaxed text-forest-900">
          After registering you can sign in only once the platform administrator has verified
          your company. You will complete the company profile after activation.
        </p>

        {formError && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
            {formError}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account…' : 'Create company account'}
        </Button>
      </form>
    </AuthShell>
  );
}
