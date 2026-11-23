import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ApiError } from '../../api/client';

export const Login: React.FC = () => {
  const { login, getDashboardRoute } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const user = await login(email, password);
      const from = (location.state as any)?.from?.pathname;
      navigate(from || getDashboardRoute(user.role), { replace: true });
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setErrorMessage('Invalid email or password.');
        } else if (err.status === 403) {
          setErrorMessage('This account is awaiting platform verification.');
        } else {
          setErrorMessage(err.message || 'Login failed. Please try again.');
        }
      } else {
        setErrorMessage('Network error. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-mint flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-mint-300/60 p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex w-12 h-12 rounded-xl bg-forest-900 text-mint font-bold text-2xl items-center justify-center mb-3 shadow-xs">
            SL
          </div>
          <h1 className="text-2xl font-bold text-forest-900 tracking-tight">
            Sign in to STAGELINK
          </h1>
          <p className="text-xs text-mutedText mt-1">
            University Internship Management Platform
          </p>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email address"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. user@stagelink.demo"
          />

          <Input
            label="Password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />

          <Button type="submit" className="w-full mt-2" isLoading={isLoading}>
            Sign in
          </Button>
        </form>

        <div className="mt-6 pt-6 border-t border-mint-200/80 text-center">
          <p className="text-xs text-mutedText">
            New company?{' '}
            <Link
              to="/register/company"
              className="text-surface-700 font-semibold hover:underline"
            >
              Create a company account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
