import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { ChangePasswordModal } from '@/features/auth/components/ChangePasswordModal';
import { useAuth } from '@/features/auth/AuthProvider';
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
} from '../components/ProfileLayout';
import { TextField } from '../components/TextField';
import { useSaveFeedback } from '../components/useProfileSave';
import { useSaveProfile } from '../hooks';
import { accountSchema, type AccountFormValues } from '../schemas';
import { S } from '../strings';
import { accountChanges } from '../utils';

/**
 * University — Profile, Figma 28:1555. university_admin has no role profile (plan Δ): only the account
 * name/email are editable, reference data is a read-only note, "Security settings" is removed.
 */
export function UniversityProfilePage() {
  const { user } = useAuth();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const save = useSaveProfile();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    values: user ? { name: user.name, email: user.email } : undefined,
  });
  const feedback = useSaveFeedback<AccountFormValues>(setError, { name: 'name', email: 'email' });

  if (!user) {
    return (
      <>
        <ProfileHeader title={S.university.title} subtitle={S.university.subtitle} />
        <ProfileLoading />
      </>
    );
  }

  const onSubmit = handleSubmit(async (values) => {
    try {
      await save.mutateAsync({ account: accountChanges(user, values) });
      reset(values);
      feedback.onSaved();
    } catch (error) {
      feedback.onFailed(error);
    }
  });

  return (
    <>
      <ProfileHeader title={S.university.title} subtitle={S.university.subtitle} />
      <form onSubmit={onSubmit} noValidate className="mt-8">
        <ProfilePanel>
          <ProfileIdentity name={user.name} meta={ROLE_LABEL.university_admin} />

          <ProfileSection title={S.university.info}>
            <FieldGrid>
              <TextField label={S.university.universityName} autoComplete="organization" error={errors.name?.message} {...register('name')} />
              <TextField label={S.common.email} type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
            </FieldGrid>
          </ProfileSection>

          <ProfileSection title={S.university.faculties} description={S.university.facultiesNote} />

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
