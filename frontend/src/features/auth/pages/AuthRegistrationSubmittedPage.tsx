import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { Logo } from '@/components/ui/Logo';
import { StatusPill } from '@/components/ui/StatusPill';
import { S } from '../strings';

/** Registration Submitted — Figma 62:37 (600 px card). Static: the public API cannot report status. */
export function AuthRegistrationSubmittedPage() {
  return (
    <main className="flex min-h-screen items-start justify-center bg-canvas p-4 pb-12 sm:items-center sm:p-6">
      <div className="w-full max-w-[600px] rounded-[20px] border border-line bg-mint px-5 pb-12 pt-[29px] sm:px-[50px] sm:pb-[116px]">
        <div className="flex justify-center">
          <Logo size="md" />
        </div>
        <h1 className="mt-[30px] text-center text-[22px] font-bold leading-[27px] text-forest-900">
          {S.submitted.title}
        </h1>
        <p className="mt-[9px] text-[13px] leading-4 text-muted">{S.submitted.body}</p>

        <div className="mt-8 h-20 rounded-card border border-line bg-canvas px-5 pt-3.5">
          <p className="text-[12px] font-medium leading-[15px] text-muted">{S.submitted.statusLabel}</p>
          <StatusPill domain="verification" value="pending" className="mt-[11px] w-[170px] px-0" />
        </div>

        <Link
          to={ROUTES.login}
          className="clickable mx-auto mt-10 flex h-11 w-full max-w-[300px] items-center justify-center rounded-xl bg-surface-600 text-[14px] font-medium text-inverse hover:bg-surface-700"
        >
          {S.submitted.backToLogin}
        </Link>
      </div>
    </main>
  );
}
