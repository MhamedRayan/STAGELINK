import { Link } from 'react-router-dom';
import { Button } from '@/components/ui';
import { AuthShell } from './AuthShell';

export function RegisterSubmittedPage() {
  return (
    <AuthShell
      title="Registration received"
      subtitle="Your company account has been created and is waiting for verification."
    >
      <div className="space-y-5">
        <div className="flex items-center gap-3 rounded-lg bg-mint px-4 py-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-success">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </span>
          <div>
            <p className="text-sm font-semibold text-forest-900">Pending verification</p>
            <p className="text-xs text-muted">A platform administrator will review the account.</p>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-muted">
          You cannot sign in yet. Once your company is verified, use the email address and
          password you just chose to log in and complete your company profile.
        </p>

        <Link to="/login" className="block">
          <Button className="w-full">Back to log in</Button>
        </Link>
      </div>
    </AuthShell>
  );
}
