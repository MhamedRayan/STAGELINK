import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { identityApi } from '@/lib/api/identity';
import { clearTokens } from '@/lib/api/tokens';
import { useAuth } from '@/lib/auth/AuthContext';
import { useToast } from '@/components/Toast';
import {
  Button,
  Card,
  Field,
  Input,
  Modal,
  PageHeader,
} from '@/components/ui';

export function AccountProfilePage({
  title,
  subtitle,
  note,
}: {
  title: string;
  subtitle?: string;
  note?: string;
}) {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [error, setError] = useState<string | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
    }
  }, [user]);

  const save = useMutation({
    mutationFn: () => identityApi.updateMe({ name, email }),
    onSuccess: () => {
      toast.success('Account details saved.');
      setError(null);
      void refreshUser();
    },
    onError: (caught) => {
      setError(caught instanceof Error ? caught.message : 'Could not save the account details.');
    },
  });

  const changePassword = useMutation({
    mutationFn: () =>
      identityApi.changePassword({ current_password: currentPassword, new_password: newPassword }),
    onSuccess: () => {
      clearTokens();
      navigate('/password-changed', { replace: true });
    },
    onError: (caught) => {
      setPasswordError(caught instanceof Error ? caught.message : 'Could not change the password.');
    },
  });

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        action={
          <Button variant="secondary" onClick={() => setPasswordOpen(true)}>
            Change password
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-6">
        <Card className="col-span-2">
          <h2 className="text-lg font-semibold text-forest-900">Account information</h2>
          <div className="mt-5 grid grid-cols-2 gap-4">
            <Field label="Full name" htmlFor="account-name" required>
              <Input id="account-name" value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
            <Field label="Email address" htmlFor="account-email" required>
              <Input
                id="account-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
          </div>
          {error && (
            <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          <Button className="mt-5" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </Card>

        <Card muted>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Account settings
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-forest-900/80">
            {note ??
              'This role has no additional profile fields. Reference data is managed by the platform administrator.'}
          </p>
        </Card>
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
              disabled={
                changePassword.isPending || newPassword.length < 12 || newPassword !== confirmPassword
              }
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
          <Field label="New password" htmlFor="new-password" hint="At least 12 characters." required>
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
          {passwordError && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
              {passwordError}
            </p>
          )}
          <p className="text-xs text-muted">Changing your password signs you out of all sessions.</p>
        </div>
      </Modal>
    </div>
  );
}
