import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { SupervisorRoleProfile } from '@/api/profile';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
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
import { useSaveProfile, useSupervisorProfile, useSupervisorSummary } from '../hooks';
import { supervisorProfileSchema, type SupervisorProfileFormValues } from '../schemas';
import { S } from '../strings';
import { accountChanges } from '../utils';

/** Supervisor — Profile, Figma 27:1013. Phone/Faculty removed (plan Δ); grade is kept but not editable. */
export function SupervisorProfilePage() {
  const { user } = useAuth();
  const query = useSupervisorProfile();
  if (query.error) {
    return (
      <>
        <ProfileHeader title={S.supervisor.title} subtitle={S.supervisor.subtitle} />
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </>
    );
  }
  if (!user || !query.data) {
    return (
      <>
        <ProfileHeader title={S.supervisor.title} subtitle={S.supervisor.subtitle} />
        <ProfileLoading />
      </>
    );
  }
  return <SupervisorProfileForm user={user} profile={query.data} />;
}

function SummaryBox({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-[12px] border border-line bg-canvas px-4 py-3">
      <span className="block text-[11px] font-medium leading-[15px] text-muted">{label}</span>
      <span className="mt-1 block text-[20px] font-bold leading-6 text-forest-900">{value ?? '–'}</span>
    </div>
  );
}

function SupervisorProfileForm({ user, profile }: { user: AuthUser; profile: SupervisorRoleProfile }) {
  const [passwordOpen, setPasswordOpen] = useState(false);
  const save = useSaveProfile();
  const summary = useSupervisorSummary();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SupervisorProfileFormValues>({
    resolver: zodResolver(supervisorProfileSchema),
    defaultValues: {
      name: user.name,
      email: user.email,
      university: profile.university,
      department: profile.department,
    },
  });
  const feedback = useSaveFeedback<SupervisorProfileFormValues>(setError, {
    name: 'name',
    email: 'email',
    university: 'university',
    department: 'department',
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await save.mutateAsync({
        account: accountChanges(user, values),
        // PUT is a full replace: keep the stored grade even though it is not editable here.
        role: { university: values.university, department: values.department, grade: profile.grade },
      });
      reset(values);
      feedback.onSaved();
    } catch (error) {
      feedback.onFailed(error);
    }
  });

  return (
    <>
      <ProfileHeader title={S.supervisor.title} subtitle={S.supervisor.subtitle} />
      <form onSubmit={onSubmit} noValidate className="mt-8">
        <ProfilePanel>
          <ProfileIdentity
            name={user.name}
            meta={profileMeta(ROLE_LABEL.supervisor, profile.university, profile.department)}
          />

          <ProfileSection title={S.supervisor.personal}>
            <FieldGrid>
              <TextField label={S.common.fullName} autoComplete="name" error={errors.name?.message} {...register('name')} />
              <TextField label={S.common.email} type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
              <TextField label={S.supervisor.university} error={errors.university?.message} {...register('university')} />
              <TextField label={S.supervisor.department} error={errors.department?.message} {...register('department')} />
            </FieldGrid>
          </ProfileSection>

          <ProfileSection title={S.supervisor.summary}>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <SummaryBox label={S.supervisor.assigned} value={summary.data?.assigned} />
              <SummaryBox label={S.supervisor.active} value={summary.data?.active} />
              <SummaryBox label={S.supervisor.pending} value={summary.data?.pendingReviews} />
              <SummaryBox label={S.supervisor.evaluations} value={summary.data?.evaluationsRecorded} />
            </div>
            <p className="mt-4 text-[12px] leading-[18px] text-muted">{S.supervisor.note}</p>
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
