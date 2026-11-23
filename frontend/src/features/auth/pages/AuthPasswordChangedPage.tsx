import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { Logo } from '@/components/ui/Logo';
import { PW } from '../passwordStrings';

/** Password Changed — Figma 62:97 (600×400 card). Tokens were cleared before navigating here. */
export function AuthPasswordChangedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas">
      <div className="w-[600px] rounded-[20px] border border-line bg-mint px-[50px] pb-[136px] pt-[29px]">
        <div className="flex justify-center">
          <Logo size="md" />
        </div>
        <h1 className="mt-10 text-center text-[22px] font-bold leading-[27px] text-forest-900">
          {PW.changed.title}
        </h1>
        <p className="mt-[9px] text-center text-[13px] leading-4 text-muted">{PW.changed.body}</p>
        <Link
          to={ROUTES.login}
          className="mx-auto mt-[58px] flex h-11 w-[300px] items-center justify-center rounded-xl bg-surface-600 text-[14px] font-medium text-inverse hover:bg-surface-700"
        >
          {PW.changed.backToLogin}
        </Link>
      </div>
    </main>
  );
}
