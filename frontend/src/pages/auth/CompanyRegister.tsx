import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ApiError } from '../../api/client';

export const CompanyRegister: React.FC = () => {
  const { registerCompany } = useAuth();
  const navigate = useNavigate();

  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setFieldErrors({});

    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: ['Passwords do not match.'] });
      return;
    }

    setIsLoading(true);

    try {
      await registerCompany({
        name: companyName,
        email,
        password,
      });
      navigate('/register/submitted');
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.fieldErrors) {
          setFieldErrors(err.fieldErrors);
        } else {
          setGeneralError(err.message);
        }
      } else {
        setGeneralError('Registration failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-mint flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-mint-300/60 p-8">
        <div className="text-center mb-6">
          <div className="inline-flex w-12 h-12 rounded-xl bg-forest-900 text-mint font-bold text-2xl items-center justify-center mb-3 shadow-xs">
            SL
          </div>
          <h1 className="text-2xl font-bold text-forest-900 tracking-tight">
            Create Company Account
          </h1>
          <p className="text-xs text-mutedText mt-1">
            Accounts require verification by the platform administrator before activation.
          </p>
        </div>

        {generalError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
            {generalError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Company Name"
            type="text"
            required
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="e.g. ACME Solutions"
            error={fieldErrors.name?.[0]}
          />

          <Input
            label="Work Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="contact@company.com"
            error={fieldErrors.email?.[0]}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              error={fieldErrors.password?.[0]}
            />

            <Input
              label="Confirm Password"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              error={fieldErrors.confirmPassword?.[0]}
            />
          </div>

          <Button type="submit" className="w-full mt-4" isLoading={isLoading}>
            Submit Registration
          </Button>
        </form>

        <div className="mt-6 pt-6 border-t border-mint-200/80 text-center">
          <Link
            to="/login"
            className="text-xs text-surface-700 font-semibold hover:underline"
          >
            ← Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
};
