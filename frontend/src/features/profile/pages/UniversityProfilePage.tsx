import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { ChangePasswordModal } from '@/features/auth/components/ChangePasswordModal';
import { useAuth } from '@/features/auth/AuthProvider';
import { ProfileLogoutButton } from '../components/ProfileLogoutButton';
import { ACTION_BUTTON, CardTitle, ProfileCard, ProfileHeader, ProfileLoading, ProfileRow } from '../components/ProfileLayout';
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
        <ProfileHeader title={S.university.title} subtitle={S.university.subtitle} action={<ProfileLogoutButton />} />
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
      <ProfileHeader title={S.university.title} subtitle={S.university.subtitle} action={<ProfileLogoutButton />} />
      <form onSubmit={onSubmit} noValidate>
        <ProfileRow>
          <ProfileCard className="min-h-[560px] w-full pb-8 lg:min-h-[640px] lg:w-[540px]">
            <CardTitle>{S.university.info}</CardTitle>
            <div className="mt-[21px] space-y-2">
              <TextField label={S.university.universityName} autoComplete="organization" error={errors.name?.message} {...register('name')} />
              <TextField label={S.common.email} type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
            </div>
            <Button type="submit" isLoading={isSubmitting} className={`${ACTION_BUTTON} mt-8`}>
              {S.common.save}
            </Button>
          </ProfileCard>

          <ProfileCard className="min-h-[560px] w-full pb-8 lg:min-h-[640px] lg:w-[540px]">
            <CardTitle>{S.university.faculties}</CardTitle>
            <p className="mt-[21px] text-[12px] leading-[15px] text-muted">{S.university.facultiesNote}</p>
            <div className="mt-[39px]">
              <CardTitle>{S.university.accountSettings}</CardTitle>
            </div>
            <Button
              variant="secondary"
              className="mt-5 h-10 w-full rounded-[10px] text-[13px] font-medium sm:w-[220px]"
              onClick={() => setPasswordOpen(true)}
            >
              {S.common.changePassword}
            </Button>
          </ProfileCard>
        </ProfileRow>
      </form>
      <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </>
  );
}
