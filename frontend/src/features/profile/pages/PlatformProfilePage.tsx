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

/** Platform — Profile, Figma 24:605. platform_admin has no role profile: account fields only (plan Δ). */
export function PlatformProfilePage() {
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
        <ProfileHeader title={S.platform.title} subtitle={S.platform.subtitle} />
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
      <ProfileHeader title={S.platform.title} subtitle={S.platform.subtitle} />
      <form onSubmit={onSubmit} noValidate className="mt-8">
        <ProfilePanel>
          <ProfileIdentity name={user.name} meta={ROLE_LABEL.platform_admin} />

          <ProfileSection title={S.platform.account}>
            <FieldGrid>
              <TextField label={S.common.fullName} autoComplete="name" error={errors.name?.message} {...register('name')} />
              <TextField label={S.common.email} type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
              <TextField label={S.platform.role} readOnly tabIndex={-1} value={S.platform.roleValue} className="text-muted" />
            </FieldGrid>
          </ProfileSection>

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
