import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../auth/useAuth';
import { apiRequest } from '../../api/client';
import { SectionCard } from '../../components/ui/SectionCard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';

interface SupervisorProfileData {
  department: string;
  grade: string;
}

export const SupervisorProfile: React.FC = () => {
  const { user, updateUser, changePassword } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');

  const [profile, setProfile] = useState<SupervisorProfileData>({
    department: '',
    grade: '',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Summary counts per design-plan §3.5
  const [summaryCounts, setSummaryCounts] = useState({
    assignedStudents: 0,
    activeInternships: 0,
  });

  // Change Password Modal
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadProfile() {
      setIsLoading(true);
      try {
        const [profData, internRes] = await Promise.all([
          apiRequest<SupervisorProfileData>('/svc/identity/api/users/me/profile/').catch(() => null),
          apiRequest<{ results: any[] }>('/svc/internships/api/internships/', {
            params: { mine: true, limit: 100 },
          }).catch(() => null),
        ]);

        if (!isMounted) return;

        if (profData) {
          setProfile({
            department: profData.department || '',
            grade: profData.grade || '',
          });
        }

        if (internRes && internRes.results) {
          const items = internRes.results;
          const distinctStudents = new Set(items.map((i) => i.student_user_id)).size;
          const active = items.filter((i) => i.status === 'confirmed' || i.status === 'in_progress').length;
          setSummaryCounts({
            assignedStudents: distinctStudents,
            activeInternships: active,
          });
        }
      } catch {
        // silent
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadProfile();
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

      setSuccessMessage('Supervisor profile updated successfully.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update profile.');
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
          <h1 className="text-2xl font-bold text-forest-900 tracking-tight">Supervisor Profile</h1>
          <p className="text-xs text-mutedText mt-1">
            Manage your faculty title, academic department, and supervision settings.
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

      <form onSubmit={handleSaveProfile} className="space-y-6">
        <SectionCard title="Personal Information">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Full Name"
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

        <SectionCard title="Academic Faculty Details">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Academic Department"
              required
              value={profile.department}
              onChange={(e) => setProfile({ ...profile, department: e.target.value })}
              placeholder="e.g. Software Engineering"
            />
            <Input
              label="Academic Grade / Title"
              required
              value={profile.grade}
              onChange={(e) => setProfile({ ...profile, grade: e.target.value })}
              placeholder="e.g. Professor / Associate Professor"
            />
          </div>
        </SectionCard>

        {/* Assignment Summary Card */}
        <SectionCard title="Supervision Summary">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-mint-50/50 rounded-lg border border-mint-200">
              <span className="text-mutedText">Assigned Students</span>
              <div className="text-2xl font-bold text-forest-900 mt-1">
                {summaryCounts.assignedStudents}
              </div>
            </div>
            <div className="p-4 bg-mint-50/50 rounded-lg border border-mint-200">
              <span className="text-mutedText">Active Placements</span>
              <div className="text-2xl font-bold text-forest-900 mt-1">
                {summaryCounts.activeInternships}
              </div>
            </div>
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
