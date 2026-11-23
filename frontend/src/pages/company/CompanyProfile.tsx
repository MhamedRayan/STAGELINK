import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Building2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../auth/useAuth';
import { apiRequest } from '../../api/client';
import { SectionCard } from '../../components/ui/SectionCard';
import { StatusPill } from '../../components/ui/StatusPill';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';

interface CompanyProfileData {
  legal_name: string;
  address: string;
  contact_person: string;
  phone: string;
  website: string;
  description: string;
  verification_status?: string;
  rejection_reason?: string;
}

export const CompanyProfile: React.FC = () => {
  const { user, updateUser, changePassword } = useAuth();
  const navigate = useNavigate();

  // Personal/Account
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');

  // Role Profile
  const [profile, setProfile] = useState<CompanyProfileData>({
    legal_name: '',
    address: '',
    contact_person: '',
    phone: '',
    website: '',
    description: '',
  });

  const [verificationStatus, setVerificationStatus] = useState<string>('pending');
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Change Password Modal
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadCompanyProfile() {
      setIsLoading(true);
      try {
        const data = await apiRequest<CompanyProfileData>(
          '/svc/identity/api/users/me/profile/'
        );
        if (isMounted) {
          setProfile({
            legal_name: data.legal_name || '',
            address: data.address || '',
            contact_person: data.contact_person || '',
            phone: data.phone || '',
            website: data.website || '',
            description: data.description || '',
          });
          if (data.verification_status) {
            setVerificationStatus(data.verification_status);
          }
          if (data.rejection_reason) {
            setRejectionReason(data.rejection_reason);
          }
        }
      } catch {
        // Fallback
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadCompanyProfile();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSaving(true);

    try {
      if (name !== user?.name || email !== user?.email) {
        await apiRequest('/svc/identity/api/users/me/', {
          method: 'PATCH',
          body: JSON.stringify({ name, email }),
        });
        updateUser({ name, email });
      }

      await apiRequest('/svc/identity/api/users/me/profile/', {
        method: 'PUT',
        body: JSON.stringify(profile),
      });

      setSuccessMessage('Company profile saved successfully.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save profile changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    setIsChangingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setIsPasswordModalOpen(false);
      navigate('/password-changed');
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to change password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 flex justify-center items-center">
        <div className="w-8 h-8 border-3 border-surface-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-forest-900 tracking-tight">
            Company Profile
          </h1>
          <p className="text-xs text-mutedText mt-1">
            Maintain your organisation profile, contact details, and platform credentials.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsPasswordModalOpen(true)}
          className="text-xs"
        >
          <Lock className="w-3.5 h-3.5 mr-1" /> Change Password
        </Button>
      </div>

      {/* Verification Status Card */}
      <div className="bg-white rounded-xl p-6 border border-mint-300/60 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-mint flex items-center justify-center text-surface-700 font-bold shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-bold text-forest-900">
                Platform Verification Status
              </h3>
              <StatusPill status={verificationStatus} type="verification" />
            </div>
            <p className="text-xs text-mutedText">
              {verificationStatus === 'active'
                ? 'Your company is verified and approved by the platform administrator. Your offers are visible to all students.'
                : verificationStatus === 'pending'
                ? 'Your registration is awaiting verification by the platform administrator. Offers cannot be published until approved.'
                : 'Your verification request was rejected.'}
            </p>
            {rejectionReason && (
              <p className="text-xs text-red-700 mt-2 p-2 bg-red-50 rounded-md border border-red-200">
                Reason: {rejectionReason}
              </p>
            )}
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="p-3 bg-emerald-50 text-emerald-700 text-xs rounded-lg border border-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSaveProfile} className="space-y-6">
        {/* Company & Legal Info */}
        <SectionCard title="Company Information">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Legal Company Name"
              required
              value={profile.legal_name}
              onChange={(e) => setProfile({ ...profile, legal_name: e.target.value })}
              placeholder="e.g. ACME Solutions SARL"
            />
            <Input
              label="Account Display Name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="md:col-span-2">
              <Input
                label="Physical Address / Location"
                required
                value={profile.address}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                placeholder="e.g. 12 Rue Didouche Mourad, Algiers"
              />
            </div>
            <div className="md:col-span-2">
              <Textarea
                label="Company Overview & Description"
                required
                rows={3}
                value={profile.description}
                onChange={(e) => setProfile({ ...profile, description: e.target.value })}
                placeholder="Describe your company, industry domain, and internship environment..."
              />
            </div>
          </div>
        </SectionCard>

        {/* Contact Information */}
        <SectionCard title="Contact & Public Links">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Contact Person Name"
              required
              value={profile.contact_person}
              onChange={(e) => setProfile({ ...profile, contact_person: e.target.value })}
              placeholder="e.g. Sarah Mansour (HR Lead)"
            />
            <Input
              label="Contact Phone Number"
              required
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              placeholder="+213 21 00 00 00"
            />
            <Input
              label="Account Email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label="Company Website URL"
              value={profile.website}
              onChange={(e) => setProfile({ ...profile, website: e.target.value })}
              placeholder="https://example.com"
            />
          </div>
        </SectionCard>

        <div className="flex justify-end">
          <Button type="submit" isLoading={isSaving}>
            Save Changes
          </Button>
        </div>
      </form>

      {/* Change Password Modal */}
      <Modal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        title="Change Password"
      >
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <p className="text-xs text-mutedText">
            All active sessions will be revoked upon password update.
          </p>

          {passwordError && (
            <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
              {passwordError}
            </div>
          )}

          <Input
            label="Current Password"
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />

          <Input
            label="New Password"
            type="password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />

          <Input
            label="Confirm New Password"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          <div className="flex justify-end gap-3 pt-3 border-t border-mint-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsPasswordModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isChangingPassword}>
              Update Password
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
