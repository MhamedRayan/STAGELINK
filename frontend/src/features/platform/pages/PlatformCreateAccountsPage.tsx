import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  Button,
  Field,
  Input,
  Modal,
  PageHeader,
  useToast,
} from '@/components/ui';
import type { AdminUserCreateResponse } from '@/api/identity';
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

/** One provisioning card: 540 x 610 in 24:447. Platform provisions company and university accounts only. */
function ProvisionCard({
  copy,
  onCreated,
}: {
  copy: CardCopy;
  onCreated(result: AdminUserCreateResponse): void;
}) {
  const toast = useToast();
  const create = useCreateAccount();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProvisionAccountFormValues>({
    resolver: zodResolver(provisionAccountSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      generatePassword: false,
      role: copy.role,
      university: '',
    },
  });
  const generatePassword = watch('generatePassword');

  const onSubmit = handleSubmit(async (values) => {
    try {
      const result = await create.mutateAsync({
        name: values.name,
        email: values.email,
        role: copy.role,
        generate_password: values.generatePassword,
        ...(values.generatePassword ? {} : { password: values.password }),
        ...(copy.role === 'university_admin' ? { university: values.university } : {}),
      });
      toast.success(S.accounts.created);
      onCreated(result);
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
    <section className="h-[610px] rounded-panel bg-mint p-5">
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
              disabled={generatePassword}
            />
          </Field>
          <label className="mt-[32px] flex h-10 cursor-pointer items-center gap-3 rounded-[8px] border border-line bg-canvas px-[14px] text-[13px] text-forest-900">
            <input {...register('generatePassword')} type="checkbox" className="h-4 w-4 accent-surface-600" />
            {S.accounts.generatePassword}
          </label>
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

/** Platform — Create Accounts, Figma 24:447. */
export function PlatformCreateAccountsPage() {
  const toast = useToast();
  const [oneTime, setOneTime] = useState<AdminUserCreateResponse | null>(null);

  const copyPassword = async () => {
    if (!oneTime?.one_time_password) return;
    try {
      await navigator.clipboard.writeText(oneTime.one_time_password);
      toast.success(S.accounts.copied);
    } catch {
      toast.error(S.accounts.oneTimeNote);
    }
  };

  return (
    <div className="max-w-content">
      <PageHeader title={S.accounts.title} subtitle={S.accounts.subtitle} />

      <div className="mt-[35px] grid grid-cols-1 gap-5 lg:grid-cols-2">
        {CARDS.map((card) => (
          <ProvisionCard key={card.role} copy={card} onCreated={setOneTime} />
        ))}
      </div>

      <Modal
        open={!!oneTime}
        onClose={() => setOneTime(null)}
        title={S.accounts.oneTimeTitle}
        footer={
          <Button variant="secondary" onClick={() => setOneTime(null)}>
            {S.common.close}
          </Button>
        }
      >
        <p className="text-[13px] text-muted">{S.accounts.oneTimeNote}</p>
        <p className="mt-4 break-all rounded-[8px] border border-line bg-canvas p-3 text-[16px] font-semibold text-forest-900">
          {oneTime?.one_time_password}
        </p>
        <Button variant="secondary" className="mt-4" onClick={() => void copyPassword()}>
          {S.accounts.copy}
        </Button>
      </Modal>
    </div>
  );
}
