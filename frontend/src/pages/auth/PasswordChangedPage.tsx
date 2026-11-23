import { Link } from 'react-router-dom';
import { Button } from '@/components/ui';
import { AuthShell } from './AuthShell';

export function PasswordChangedPage() {
  return (
    <AuthShell
      title="Password updated"
      subtitle="Your password has been changed and all other sessions were signed out."
    >
      <div className="space-y-5">
        <div className="flex items-center gap-3 rounded-lg bg-mint px-4 py-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-success">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </span>
          <p className="text-sm font-semibold text-forest-900">
            You can now log in with your new password.
          </p>
        </div>

        <Link to="/login" className="block">
          <Button className="w-full">Back to log in</Button>
        </Link>
      </div>
    </AuthShell>
  );
}
