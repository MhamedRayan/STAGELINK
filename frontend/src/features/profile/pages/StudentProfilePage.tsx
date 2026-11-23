import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { StudentRoleProfile } from '@/api/profile';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { ChangePasswordModal } from '@/features/auth/components/ChangePasswordModal';
import { useAuth, type AuthUser } from '@/features/auth/AuthProvider';
import { ACTION_BUTTON, CardTitle, ProfileCard, ProfileHeader, ProfileLoading, ProfileRow } from '../components/ProfileLayout';
import { TextField } from '../components/TextField';
import { useSaveFeedback } from '../components/useProfileSave';
import { useSaveProfile, useStudentProfile } from '../hooks';
import { studentProfileSchema, type StudentProfileFormValues } from '../schemas';
import { S } from '../strings';
import { accountChanges } from '../utils';

/** Student — Profile, Figma 25:1778. Phone/contact preference removed, Faculty folded into Department (plan Δ). */
export function StudentProfilePage() {
  const { user } = useAuth();
  const query = useStudentProfile();
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (!user || !query.data) {
    return (
      <>
        <ProfileHeader title={S.student.title} subtitle={S.student.subtitle} />
        <ProfileLoading />
      </>
    );
  }
  return <StudentProfileForm user={user} profile={query.data} />;
}

function StudentProfileForm({ user, profile }: { user: AuthUser; profile: StudentRoleProfile }) {
  const [passwordOpen, setPasswordOpen] = useState(false);
  const save = useSaveProfile();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<StudentProfileFormValues>({
    resolver: zodResolver(studentProfileSchema),
    defaultValues: {
      name: user.name,
      email: user.email,
      matricule: profile.matricule,
      university: profile.university,
      department: profile.department,
      specialty: profile.specialty,
      academicYear: profile.academic_year,
    },
  });
  const feedback = useSaveFeedback<StudentProfileFormValues>(setError, {
    name: 'name',
    email: 'email',
    matricule: 'matricule',
    university: 'university',
    department: 'department',
    specialty: 'specialty',
    academic_year: 'academicYear',
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await save.mutateAsync({
        account: accountChanges(user, values),
        role: {
          university: values.university,
          department: values.department,
          specialty: values.specialty,
          academic_year: values.academicYear,
          matricule: values.matricule,
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
      <ProfileHeader title={S.student.title} subtitle={S.student.subtitle} />
      <form onSubmit={onSubmit} noValidate>
        <ProfileRow>
          <ProfileCard className="h-[640px] w-[540px]">
            <CardTitle>{S.student.personal}</CardTitle>
            <div className="mt-[27px] space-y-2">
              <TextField label={S.common.fullName} autoComplete="name" error={errors.name?.message} {...register('name')} />
              <TextField label={S.common.email} type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
            </div>
            <div className="absolute left-[71px] top-[510px] flex gap-4">
              <Button type="submit" isLoading={isSubmitting} className={ACTION_BUTTON}>
                {S.common.save}
              </Button>
              <Button variant="secondary" className={ACTION_BUTTON} onClick={() => setPasswordOpen(true)}>
                {S.common.changePassword}
              </Button>
            </div>
          </ProfileCard>

          <ProfileCard className="h-[640px] w-[540px]">
            <CardTitle>{S.student.academic}</CardTitle>
            <div className="mt-[27px]">
              <TextField controlGap="sm" label={S.student.studentId} error={errors.matricule?.message} {...register('matricule')} />
              <TextField controlGap="sm" label={S.student.university} error={errors.university?.message} {...register('university')} />
              <TextField controlGap="sm" label={S.student.department} error={errors.department?.message} {...register('department')} />
              <TextField controlGap="sm" label={S.student.specialty} error={errors.specialty?.message} {...register('specialty')} />
              <TextField controlGap="sm" label={S.student.academicYear} error={errors.academicYear?.message} {...register('academicYear')} />
            </div>
          </ProfileCard>
        </ProfileRow>
      </form>
      <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </>
  );
}
