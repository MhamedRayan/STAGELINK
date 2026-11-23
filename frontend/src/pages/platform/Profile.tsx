import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, CheckCircle2, AlertCircle, Shield } from 'lucide-react';
import { useAuth } from '../../auth/useAuth';
import { apiRequest } from '../../api/client';
import { SectionCard } from '../../components/ui/SectionCard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';

export const PlatformProfile: React.FC = () => {
  const { user, updateUser, changePassword } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
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

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSaving(true);

    try {
      await apiRequest('/svc/identity/api/users/me/', {
        method: 'PATCH',
        body: JSON.stringify({ name, email }),
      });
      updateUser({ name, email });
      setSuccessMessage('Administrator credentials updated successfully.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update credentials.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
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

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-forest-900 tracking-tight">
            Platform Administrator Profile
          </h1>
          <p className="text-xs text-mutedText mt-1">
            Manage your master administrative account credentials and security settings.
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

      {/* Role Notice */}
      <div className="p-4 bg-forest-900 text-inverseText rounded-xl flex items-center gap-3">
        <Shield className="w-6 h-6 text-mint shrink-0" />
        <div className="text-xs">
          <span className="font-bold block text-sm mb-0.5">Platform Root Privileges</span>
          <span>
            This account holds platform administration privileges, with full control over user provisioning and company verification.
          </span>
        </div>
      </div>

      <form onSubmit={handleSaveProfile} className="space-y-6">
        <SectionCard title="Account Information">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Administrator Full Name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              label="Email Address"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
