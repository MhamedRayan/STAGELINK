import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { identityApi } from '@/lib/api/identity';
import { clearTokens } from '@/lib/api/tokens';
import type { CompanyRoleProfile } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/AuthContext';
import { verificationStatuses, statusMeta } from '@/lib/status';
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
  StatusPill,
  Textarea,
} from '@/components/ui';

export function CompanyProfilePage() {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();

  const profile = useQuery({ queryKey: ['my-profile'], queryFn: identityApi.getMyProfile });

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [company, setCompany] = useState<CompanyRoleProfile | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
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

  useEffect(() => {
    if (profile.data && 'legal_name' in profile.data) {
      setCompany(profile.data as CompanyRoleProfile);
    }
  }, [profile.data]);

  const save = useMutation({
    mutationFn: async () => {
      await identityApi.updateMe({ name, email });
      if (company) {
        await identityApi.updateMyProfile({
          legal_name: company.legal_name,
          address: company.address,
          contact_person: company.contact_person,
          phone: company.phone,
          website: company.website,
          description: company.description,
        });
      }
    },
    onSuccess: () => {
      toast.success('Company profile saved.');
      setSaveError(null);
      void refreshUser();
      void queryClient.invalidateQueries({ queryKey: ['my-profile'] });
    },
    onError: (caught) => {
      setSaveError(caught instanceof Error ? caught.message : 'Could not save the profile.');
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

  if (profile.isLoading) return <LoadingBlock label="Loading company profile…" />;
  if (profile.isError) return <ErrorState onRetry={() => void profile.refetch()} />;

  function updateCompany(field: keyof CompanyRoleProfile, value: string) {
    setCompany((current) => (current ? { ...current, [field]: value } : current));
  }

  const verification = company
    ? statusMeta(verificationStatuses, company.verification_status)
    : statusMeta(verificationStatuses, 'pending');

  return (
    <div>
      <PageHeader
        title="Company Profile"
        subtitle="Information shown to students on your offers."
        action={
          <Button variant="secondary" onClick={() => setPasswordOpen(true)}>
            Change password
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <Card>
            <h2 className="text-lg font-semibold text-forest-900">Company information</h2>
            <div className="mt-5 grid grid-cols-2 gap-4">
              <Field label="Company name" htmlFor="company-name" required>
                <Input
                  id="company-name"
                  value={company?.legal_name ?? ''}
                  onChange={(event) => updateCompany('legal_name', event.target.value)}
                />
              </Field>
              <Field label="Location" htmlFor="company-address">
                <Input
                  id="company-address"
                  value={company?.address ?? ''}
                  onChange={(event) => updateCompany('address', event.target.value)}
                />
              </Field>
              <Field label="Contact person" htmlFor="company-contact">
                <Input
                  id="company-contact"
                  value={company?.contact_person ?? ''}
                  onChange={(event) => updateCompany('contact_person', event.target.value)}
                />
              </Field>
              <Field label="Phone" htmlFor="company-phone">
                <Input
                  id="company-phone"
                  value={company?.phone ?? ''}
                  onChange={(event) => updateCompany('phone', event.target.value)}
                />
              </Field>
              <div className="col-span-2">
                <Field label="Website" htmlFor="company-website">
                  <Input
                    id="company-website"
                    value={company?.website ?? ''}
                    onChange={(event) => updateCompany('website', event.target.value)}
                    placeholder="https://example.com"
                  />
                </Field>
              </div>
              <div className="col-span-2">
                <Field label="Description" htmlFor="company-description">
                  <Textarea
                    id="company-description"
                    value={company?.description ?? ''}
                    onChange={(event) => updateCompany('description', event.target.value)}
                  />
                </Field>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-forest-900">Contact</h2>
            <div className="mt-5 grid grid-cols-2 gap-4">
              <Field label="Account name" htmlFor="account-name" required>
                <Input id="account-name" value={name} onChange={(event) => setName(event.target.value)} />
              </Field>
              <Field label="Contact email" htmlFor="account-email" required>
                <Input
                  id="account-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>
            </div>
          </Card>

          {saveError && (
            <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-danger">
              {saveError}
            </p>
          )}

          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>

        <div className="space-y-6">
          <Card muted>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Account verification
            </h2>
            <div className="mt-3">
              <StatusPill meta={verification} />
            </div>
            <p className="mt-3 text-sm leading-relaxed text-forest-900/80">
              {company?.verification_status === 'active'
                ? 'Verified by the platform administrator. Your offers are visible to students.'
                : company?.verification_status === 'rejected'
                  ? company.rejection_reason || 'The platform administrator rejected this account.'
                  : 'Awaiting verification. You can prepare your profile, but offers stay hidden until the account is verified.'}
            </p>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Good to know
            </h2>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              Company name, location, contact person, phone, website and description are required
              when saving. Empty optional values are stored as empty strings.
            </p>
          </Card>
        </div>
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
        </div>
      </Modal>
    </div>
  );
}
