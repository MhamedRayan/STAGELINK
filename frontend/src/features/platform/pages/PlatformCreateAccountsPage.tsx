import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button, Field, Input, PageHeader, useToast } from '@/components/ui';
import { normalizeError } from '@/lib/errors';
import { useCreateAccount } from '../hooks';
import { provisionAccountSchema, type ProvisionAccountFormValues } from '../schemas';
import { S } from '../strings';

interface CardCopy {
  role: 'company' | 'university_admin';
  title: string;
  name: string;
  email: string;
  submit: string;
  note?: string;
}

const CARDS: CardCopy[] = [
  {
    role: 'university_admin',
    title: S.accounts.university.title,
    name: S.accounts.university.name,
    email: S.accounts.university.email,
    submit: S.accounts.university.submit,
  },
  {
    role: 'company',
    title: S.accounts.company.title,
    name: S.accounts.company.name,
    email: S.accounts.company.email,
    submit: S.accounts.company.submit,
    note: S.accounts.company.note,
  },
];

/** Platform provisioning cards: explicit initial password only, no generated passwords. */
function ProvisionCard({ copy }: { copy: CardCopy }) {
  const toast = useToast();
  const create = useCreateAccount();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProvisionAccountFormValues>({
    resolver: zodResolver(provisionAccountSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      role: copy.role,
      university: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await create.mutateAsync({
        name: values.name,
        email: values.email,
        role: copy.role,
        password: values.password,
        generate_password: false,
        ...(copy.role === 'university_admin' ? { university: values.university } : {}),
      });
      toast.success(S.accounts.created);
      reset();
    } catch (error) {
      const apiError = normalizeError(error);
      let fieldShown = false;
      for (const field of ['name', 'email', 'password', 'university'] as const) {
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
    <section className="rounded-panel bg-mint p-5">
      <h2 className="text-[16px] font-semibold leading-[19px] text-forest-900">{copy.title}</h2>

      <form onSubmit={onSubmit} noValidate>
        <div className="mt-[27px]">
          <Field label={copy.name} error={errors.name?.message} controlGap="md">
            <Input
              {...register('name')}
              hasError={!!errors.name}
              className="h-10 px-[14px] text-[13px]"
              autoComplete="organization"
            />
          </Field>
          <Field label={copy.email} error={errors.email?.message} controlGap="md" className="mt-2">
            <Input
              {...register('email')}
              hasError={!!errors.email}
              className="h-10 px-[14px] text-[13px]"
              type="email"
              autoComplete="email"
            />
          </Field>
          {copy.role === 'university_admin' && (
            <div className="mt-2">
              <Field
                label={S.accounts.university.institution}
                error={errors.university?.message}
                hint={S.accounts.university.institutionHint}
                controlGap="md"
              >
                <Input
                  {...register('university')}
                  hasError={!!errors.university}
                  className="h-10 px-[14px] text-[13px]"
                  autoComplete="organization"
                />
              </Field>
            </div>
          )}
          <Field
            label={S.accounts.password}
            error={errors.password?.message}
            controlGap="md"
            className="mt-2"
          >
            <Input
              {...register('password')}
              hasError={!!errors.password}
              className="h-10 px-[14px] text-[13px]"
              type="password"
              autoComplete="new-password"
            />
          </Field>
        </div>

        <Button
          type="submit"
          className="mt-[34px] h-10 w-full rounded-[10px] text-[13px] font-medium"
          isLoading={isSubmitting || create.isPending}
        >
          {copy.submit}
        </Button>
        {copy.note && <p className="mt-4 text-[12px] leading-4 text-muted">{copy.note}</p>}
      </form>
    </section>
  );
}

/** Platform — Create Accounts. */
export function PlatformCreateAccountsPage() {
  return (
    <div className="max-w-content">
      <PageHeader title={S.accounts.title} subtitle={S.accounts.subtitle} />

      <div className="mt-[35px] grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        {CARDS.map((card) => (
          <ProvisionCard key={card.role} copy={card} />
        ))}
      </div>
    </div>
  );
}
