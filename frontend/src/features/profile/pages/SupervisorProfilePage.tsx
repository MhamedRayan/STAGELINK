import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { SupervisorRoleProfile } from '@/api/profile';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { ChangePasswordModal } from '@/features/auth/components/ChangePasswordModal';
import { useAuth, type AuthUser } from '@/features/auth/AuthProvider';
import { ACTION_BUTTON, CardTitle, ProfileCard, ProfileHeader, ProfileLoading, ProfileRow } from '../components/ProfileLayout';
import { TextField } from '../components/TextField';
import { useSaveFeedback } from '../components/useProfileSave';
import { useSaveProfile, useSupervisorProfile, useSupervisorSummary } from '../hooks';
import { supervisorProfileSchema, type SupervisorProfileFormValues } from '../schemas';
import { S } from '../strings';
import { accountChanges } from '../utils';

/** Supervisor — Profile, Figma 27:1013. Phone/Faculty removed, Grade added (plan Δ). */
export function SupervisorProfilePage() {
  const { user } = useAuth();
  const query = useSupervisorProfile();
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
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
    <div className="relative h-16 rounded-[10px] border border-line bg-canvas">
      <span className="absolute left-5 top-4 text-[13px] font-medium leading-4 text-forest-900">{label}</span>
      <span className="absolute left-[418px] top-3.5 text-[20px] font-bold leading-6 text-forest-900">{value ?? '–'}</span>
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
      grade: profile.grade,
    },
  });
  const feedback = useSaveFeedback<SupervisorProfileFormValues>(setError, {
    name: 'name',
    email: 'email',
    university: 'university',
    department: 'department',
    grade: 'grade',
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await save.mutateAsync({
        account: accountChanges(user, values),
        role: { university: values.university, department: values.department, grade: values.grade },
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
      <form onSubmit={onSubmit} noValidate>
        <ProfileRow>
          <ProfileCard className="h-[640px] w-[540px]">
            <CardTitle>{S.supervisor.personal}</CardTitle>
            <div className="mt-[27px] space-y-2">
              <TextField label={S.common.fullName} autoComplete="name" error={errors.name?.message} {...register('name')} />
              <TextField label={S.common.email} type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
              <TextField label={S.supervisor.university} error={errors.university?.message} {...register('university')} />
              <TextField label={S.supervisor.department} error={errors.department?.message} {...register('department')} />
              <TextField label={S.supervisor.grade} error={errors.grade?.message} {...register('grade')} />
            </div>
            <div className="absolute left-5 top-[430px] flex gap-4">
              <Button type="submit" isLoading={isSubmitting} className={ACTION_BUTTON}>
                {S.common.save}
              </Button>
              <Button variant="secondary" className={ACTION_BUTTON} onClick={() => setPasswordOpen(true)}>
                {S.common.changePassword}
              </Button>
            </div>
          </ProfileCard>

          <ProfileCard className="h-[640px] w-[540px]">
            <CardTitle>{S.supervisor.summary}</CardTitle>
            <div className="mt-[27px] space-y-4">
              <SummaryBox label={S.supervisor.assigned} value={summary.data?.assigned} />
              <SummaryBox label={S.supervisor.active} value={summary.data?.active} />
              <SummaryBox label={S.supervisor.pending} value={summary.data?.pendingReviews} />
              <SummaryBox label={S.supervisor.evaluations} value={summary.data?.evaluationsRecorded} />
            </div>
            <p className="absolute left-5 top-[410px] w-[500px] text-[12px] leading-[15px] text-muted">{S.supervisor.note}</p>
          </ProfileCard>
        </ProfileRow>
      </form>
      <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </>
  );
}
