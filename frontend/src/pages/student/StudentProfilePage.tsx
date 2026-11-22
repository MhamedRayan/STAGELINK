import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { identityApi } from '@/lib/api/identity';
import { clearTokens } from '@/lib/api/tokens';
import type { StudentRoleProfile } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/AuthContext';
import { useToast } from '@/components/Toast';
import {
  Button,
  Card,
  ErrorState,
  Field,
  Input,
  LoadingBlock,
  Modal,
  PageHeader,
} from '@/components/ui';

export function StudentProfilePage() {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();

  const profile = useQuery({
    queryKey: ['my-profile'],
    queryFn: identityApi.getMyProfile,
  });

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [academic, setAcademic] = useState<StudentRoleProfile | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
    }
  }, [user]);

  useEffect(() => {
    if (profile.data && 'university' in profile.data) {
      setAcademic(profile.data as StudentRoleProfile);
    }
  }, [profile.data]);

  const save = useMutation({
    mutationFn: async () => {
      await identityApi.updateMe({ name, email });
      if (academic) {
        await identityApi.updateMyProfile({
          university: academic.university,
          department: academic.department,
          specialty: academic.specialty,
          academic_year: academic.academic_year,
          matricule: academic.matricule,
        });
      }
    },
    onSuccess: () => {
      toast.success('Profile saved.');
      setSaveError(null);
      void refreshUser();
      void queryClient.invalidateQueries({ queryKey: ['my-profile'] });
    },
    onError: (caught) => {
      setSaveError(caught instanceof Error ? caught.message : 'Could not save the profile.');
    },
  });

  const changePassword = useMutation({
    mutationFn: () => identityApi.changePassword({ current_password: currentPassword, new_password: newPassword }),
    onSuccess: () => {
      clearTokens();
      navigate('/password-changed', { replace: true });
    },
    onError: (caught) => {
      setPasswordError(caught instanceof Error ? caught.message : 'Could not change the password.');
    },
  });

  if (profile.isLoading) return <LoadingBlock label="Loading profile…" />;
  if (profile.isError) return <ErrorState onRetry={() => void profile.refetch()} />;

  function updateAcademic(field: keyof StudentRoleProfile, value: string) {
    setAcademic((current) => (current ? { ...current, [field]: value } : current));
  }

  return (
    <div>
      <PageHeader
        title="Profile"
        subtitle="Personal and academic information used on your applications."
        action={
          <Button variant="secondary" onClick={() => setPasswordOpen(true)}>
            Change password
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <h2 className="text-lg font-semibold text-forest-900">Personal information</h2>
          <div className="mt-5 space-y-4">
            <Field label="Full name" htmlFor="profile-name" required>
              <Input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
            <Field label="Email address" htmlFor="profile-email" required>
              <Input
                id="profile-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-forest-900">Academic information</h2>
          <div className="mt-5 space-y-4">
            <Field label="Student ID (matricule)" htmlFor="matricule">
              <Input
                id="matricule"
                value={academic?.matricule ?? ''}
                onChange={(event) => updateAcademic('matricule', event.target.value)}
              />
            </Field>
            <Field label="University" htmlFor="university">
              <Input
                id="university"
                value={academic?.university ?? ''}
                onChange={(event) => updateAcademic('university', event.target.value)}
              />
            </Field>
            <Field label="Department" htmlFor="department">
              <Input
                id="department"
                value={academic?.department ?? ''}
                onChange={(event) => updateAcademic('department', event.target.value)}
              />
            </Field>
            <Field label="Specialty" htmlFor="specialty">
              <Input
                id="specialty"
                value={academic?.specialty ?? ''}
                onChange={(event) => updateAcademic('specialty', event.target.value)}
              />
            </Field>
            <Field label="Academic year" htmlFor="academic-year">
              <Input
                id="academic-year"
                value={academic?.academic_year ?? ''}
                onChange={(event) => updateAcademic('academic_year', event.target.value)}
                placeholder="e.g. 2025/2026"
              />
            </Field>
          </div>
        </Card>
      </div>

      {saveError && (
        <p role="alert" className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-danger">
          {saveError}
        </p>
      )}

      <div className="mt-6">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>

      <Modal
        open={passwordOpen}
        title="Change password"
        onClose={() => setPasswordOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPasswordOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={changePassword.isPending || newPassword.length < 12 || newPassword !== confirmPassword}
              onClick={() => {
                setPasswordError(null);
                changePassword.mutate();
              }}
            >
              {changePassword.isPending ? 'Updating…' : 'Update password'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Current password" htmlFor="current-password" required>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </Field>
          <Field
            label="New password"
            htmlFor="new-password"
            hint="At least 12 characters."
            required
          >
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </Field>
          <Field label="Confirm new password" htmlFor="confirm-password" required>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </Field>
          {newPassword.length > 0 && newPassword.length < 12 && (
            <p className="text-xs text-danger">Use at least 12 characters.</p>
          )}
          {confirmPassword.length > 0 && newPassword !== confirmPassword && (
            <p className="text-xs text-danger">Passwords do not match.</p>
          )}
          {passwordError && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
              {passwordError}
            </p>
          )}
          <p className="text-xs text-muted">
            Changing your password signs you out of all sessions.
          </p>
        </div>
      </Modal>
    </div>
  );
}
