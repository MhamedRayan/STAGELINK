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
import { ROLE_LABEL } from '@/lib/roles';
import {
  ACTION_BUTTON,
  FieldGrid,
  ProfileActions,
  ProfileHeader,
  ProfileIdentity,
  ProfileLoading,
  ProfilePanel,
  ProfileSection,
  profileMeta,
} from '../components/ProfileLayout';
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
      <form onSubmit={onSubmit} noValidate className="mt-8">
        <ProfilePanel>
          <ProfileIdentity
            name={user.name}
            meta={profileMeta(ROLE_LABEL.company, profile.address)}
            badge={<StatusPill domain="verification" value={profile.verification_status} />}
          />

          <ProfileSection title={S.company.info}>
            <FieldGrid>
              <div className="sm:col-span-2">
                <TextField label={S.company.companyName} autoComplete="organization" error={errors.companyName?.message} {...register('companyName')} />
              </div>
              <TextField label={S.company.contactPerson} autoComplete="name" error={errors.contactPerson?.message} {...register('contactPerson')} />
              <TextField label={S.company.location} autoComplete="address-level2" error={errors.location?.message} {...register('location')} />
              <TextField label={S.company.website} type="url" autoComplete="url" error={errors.website?.message} {...register('website')} />
              <TextField label={S.company.phone} type="tel" autoComplete="tel" error={errors.phone?.message} {...register('phone')} />
              <div className="sm:col-span-2">
                <Field label={S.company.description} controlGap="md" error={errors.description?.message}>
                  <Textarea className="h-[110px]" hasError={Boolean(errors.description)} {...register('description')} />
                </Field>
              </div>
            </FieldGrid>
          </ProfileSection>

          <ProfileSection title={S.company.verification} description={verificationText(profile)} />

          <ProfileActions>
            <Button type="submit" isLoading={isSubmitting} className={ACTION_BUTTON}>
              {S.common.save}
            </Button>
            <Button variant="secondary" className={ACTION_BUTTON} onClick={() => setPasswordOpen(true)}>
              {S.common.changePassword}
            </Button>
          </ProfileActions>
        </ProfilePanel>
      </form>
      <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </>
  );
}
