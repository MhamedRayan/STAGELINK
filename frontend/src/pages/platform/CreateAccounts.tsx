import React, { useState } from 'react';
import { UserPlus, CheckCircle2, AlertCircle, Copy, Check } from 'lucide-react';
import { apiRequest } from '../../api/client';
import { SectionCard } from '../../components/ui/SectionCard';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';

interface CreatedAccountResult {
  id: string;
  name: string;
  email: string;
  role: string;
  generated_password?: string;
  password?: string;
}

export const PlatformCreateAccounts: React.FC = () => {
  const [role, setRole] = useState<'university_admin' | 'supervisor' | 'company'>('university_admin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [autoGeneratePassword, setAutoGeneratePassword] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdResult, setCreatedResult] = useState<CreatedAccountResult | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setCreatedResult(null);

    if (!autoGeneratePassword && password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    setIsLoading(true);
    try {
      const payload: any = {
        name,
        email,
        role,
      };

      if (autoGeneratePassword) {
        payload.generate_password = true;
      } else {
        payload.password = password;
      }

      const res = await apiRequest<CreatedAccountResult>('/svc/identity/api/admin/users/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setCreatedResult({
        ...res,
        password: autoGeneratePassword ? res.generated_password : password,
      });

      // Clear form
      setName('');
      setEmail('');
      setPassword('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create user account.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!createdResult) return;
    const text = `STAGELINK Account Created:\nRole: ${createdResult.role}\nEmail: ${createdResult.email}\nPassword: ${createdResult.password || '(hidden)'}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-forest-900 tracking-tight">Create Accounts</h1>
        <p className="text-xs text-mutedText mt-1">
          Provision verified institutional administrator, faculty supervisor, or partner company accounts.
        </p>
      </div>

      {errorMessage && (
        <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Success & Credentials Display Panel */}
      {createdResult && (
        <div className="p-6 bg-mint rounded-xl border border-mint-300 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-forest-900 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Account Provisioned Successfully</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyCredentials}
              className="text-xs bg-white"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 mr-1" /> Copy Credentials
                </>
              )}
            </Button>
          </div>

          <p className="text-xs text-forest-900/80">
            Please share these credentials securely with the account holder.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs p-4 bg-white/90 rounded-lg border border-mint-300 font-mono">
            <div>
              <span className="text-mutedText block font-sans text-[11px]">Role</span>
              <span className="font-semibold text-forest-900">{createdResult.role}</span>
            </div>
            <div>
              <span className="text-mutedText block font-sans text-[11px]">Email</span>
              <span className="font-semibold text-forest-900">{createdResult.email}</span>
            </div>
            <div>
              <span className="text-mutedText block font-sans text-[11px]">Temporary Password</span>
              <span className="font-bold text-surface-700">{createdResult.password}</span>
            </div>
          </div>
        </div>
      )}

      <SectionCard title="Account Provisioning Form">
        <form onSubmit={handleCreate} className="space-y-4 max-w-xl">
          <Select
            label="Account Role Type"
            value={role}
            onChange={(e) => setRole(e.target.value as any)}
            options={[
              { label: 'University Administrator (Institutional Admin)', value: 'university_admin' },
              { label: 'Faculty Supervisor (Academic Supervisor)', value: 'supervisor' },
              { label: 'Company (Partner Organisation)', value: 'company' },
            ]}
          />

          <Input
            label={role === 'company' ? 'Company Name' : 'Full Name / Institution Name'}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={
              role === 'university_admin'
                ? 'e.g. University of Algiers Admin'
                : role === 'supervisor'
                ? 'e.g. Prof. Karim Belkacem'
                : 'e.g. Sonatrach Innovation SARL'
            }
          />

          <Input
            label="Account Email Address"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@domain.example"
          />

          <div className="pt-2 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-forest-900 select-none">
              <input
                type="checkbox"
                checked={autoGeneratePassword}
                onChange={(e) => setAutoGeneratePassword(e.target.checked)}
                className="rounded border-mint-300 text-forest-900 focus:ring-surface-600 w-4 h-4"
              />
              <span>Auto-generate secure temporary password (Recommended)</span>
            </label>

            {!autoGeneratePassword && (
              <Input
                label="Set Initial Password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters..."
              />
            )}
          </div>

          <div className="pt-4 border-t border-mint-200">
            <Button type="submit" isLoading={isLoading}>
              <UserPlus className="w-4 h-4 mr-1.5" /> Provision Account
            </Button>
          </div>
        </form>
      </SectionCard>
    </div>
  );
};
