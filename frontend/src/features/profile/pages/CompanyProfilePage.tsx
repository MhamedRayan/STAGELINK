import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { CompanyRoleProfile } from '@/api/profile';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Field } from '@/components/ui/Field';
import { StatusPill } from '@/components/ui/StatusPill';
import { Textarea } from '@/components/ui/Textarea';
import { ChangePasswordModal } from '@/features/auth/components/ChangePasswordModal';
import { useAuth, type AuthUser } from '@/features/auth/AuthProvider';
import { ACTION_BUTTON, CardTitle, ProfileCard, ProfileHeader, ProfileLoading, ProfileRow } from '../components/ProfileLayout';
import { TextField } from '../components/TextField';
import { useSaveFeedback } from '../components/useProfileSave';
import { useCompanyProfileMe, useSaveProfile } from '../hooks';
import { companyProfileSchema, type CompanyProfileFormValues } from '../schemas';
import { S } from '../strings';

/**
 * Company — Profile, Figma 26:185. Legal form/Industry removed (plan Δ); Contact person, Website and
 * Phone are editable here because PUT /api/users/me/profile/ requires them.
 */
export function CompanyProfilePage() {
  const { user } = useAuth();
  const query = useCompanyProfileMe();
  if (query.error) {
    return (
      <>
        <ProfileHeader title={S.company.title} subtitle={S.company.subtitle} />
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </>
    );
  }
  if (!user || !query.data) {
    return (
      <>
        <ProfileHeader title={S.company.title} subtitle={S.company.subtitle} />
        <ProfileLoading />
      </>
    );
  }
  return <CompanyProfileForm user={user} profile={query.data} />;
}

function verificationText(profile: CompanyRoleProfile): string {
  if (profile.verification_status === 'active') return S.company.verified;
  if (profile.verification_status === 'rejected') return profile.rejection_reason || S.company.rejected;
  return S.company.pending;
}

function CompanyProfileForm({ user, profile }: { user: AuthUser; profile: CompanyRoleProfile }) {
  const [passwordOpen, setPasswordOpen] = useState(false);
  const save = useSaveProfile();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CompanyProfileFormValues>({
    resolver: zodResolver(companyProfileSchema),
    defaultValues: {
      companyName: profile.legal_name,
      contactPerson: profile.contact_person,
      location: profile.address,
      website: profile.website,
      phone: profile.phone,
      description: profile.description,
    },
  });
  const feedback = useSaveFeedback<CompanyProfileFormValues>(setError, {
    legal_name: 'companyName',
    contact_person: 'contactPerson',
    address: 'location',
    website: 'website',
    phone: 'phone',
    description: 'description',
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await save.mutateAsync({
        account: values.companyName !== user.name ? { name: values.companyName } : undefined,
        role: {
          legal_name: values.companyName,
          address: values.location,
          contact_person: values.contactPerson,
          phone: values.phone,
          website: values.website,
          description: values.description,
        },
      });
      reset(values);
      feedback.onSaved();
    } catch (error) {
      feedback.onFailed(error);
    }
  });

  return (
    <>
      <ProfileHeader title={S.company.title} subtitle={S.company.subtitle} />
      <form onSubmit={onSubmit} noValidate>
        <ProfileRow>
          <ProfileCard className="min-h-[620px] w-full pb-8 lg:min-h-[640px] lg:min-w-0 lg:flex-[700]">
            <CardTitle>{S.company.info}</CardTitle>
            <div className="mt-[21px] grid grid-cols-1 gap-x-5 gap-y-1.5 sm:grid-cols-2">
              <div className="col-span-2">
                <TextField label={S.company.companyName} autoComplete="organization" error={errors.companyName?.message} {...register('companyName')} />
              </div>
              <TextField label={S.company.contactPerson} autoComplete="name" error={errors.contactPerson?.message} {...register('contactPerson')} />
              <TextField label={S.company.location} autoComplete="address-level2" error={errors.location?.message} {...register('location')} />
              <TextField label={S.company.website} type="url" autoComplete="url" error={errors.website?.message} {...register('website')} />
              <TextField label={S.company.phone} type="tel" autoComplete="tel" error={errors.phone?.message} {...register('phone')} />
              <div className="col-span-2">
                <Field label={S.company.description} controlGap="md" error={errors.description?.message}>
                  <Textarea className="h-[110px]" hasError={Boolean(errors.description)} {...register('description')} />
                </Field>
              </div>
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4 lg:mt-[86px]">
              <Button type="submit" isLoading={isSubmitting} className={ACTION_BUTTON}>
                {S.common.save}
              </Button>
              <Button variant="secondary" className={ACTION_BUTTON} onClick={() => setPasswordOpen(true)}>
                {S.common.changePassword}
              </Button>
            </div>
          </ProfileCard>

          <ProfileCard className="min-h-[620px] w-full pb-8 lg:min-h-[640px] lg:min-w-0 lg:flex-[380]">
            <CardTitle>{S.company.contact}</CardTitle>
            <dl className="mt-[21px]">
              <dt className="text-[11px] leading-[13px] text-muted">{S.company.contactEmail}</dt>
              <dd className="mt-[5px] break-all text-[14px] leading-[17px] text-forest-900">{user.email}</dd>
              <dt className="mt-[21px] text-[11px] leading-[13px] text-muted">{S.company.phone}</dt>
              <dd className="mt-[5px] text-[14px] leading-[17px] text-forest-900">{profile.phone || '—'}</dd>
            </dl>
            <div className="mt-[39px]">
              <CardTitle>{S.company.verification}</CardTitle>
              <StatusPill domain="verification" value={profile.verification_status} className="mt-[15px] px-[19px]" />
              <p className="mt-2.5 max-w-[320px] text-[12px] leading-[15px] text-muted">{verificationText(profile)}</p>
            </div>
          </ProfileCard>
        </ProfileRow>
      </form>
      <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </>
  );
}
