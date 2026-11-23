import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';

export const PasswordChanged: React.FC = () => {
  return (
    <div className="min-h-screen bg-mint flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-mint-300/60 p-8 text-center">
        <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <h1 className="text-xl font-bold text-forest-900 tracking-tight mb-2">
          Password Updated
        </h1>

        <p className="text-xs text-mutedText leading-relaxed mb-6">
          Your password has been changed successfully. All active sessions have been
          invalidated for security. You can now log in with your new password.
        </p>

        <Link to="/login">
          <Button className="w-full">
            Back to Sign in
          </Button>
        </Link>
      </div>
    </div>
  );
};
