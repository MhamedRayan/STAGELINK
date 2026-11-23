import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/ui';

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-mint px-6 py-12">
      <div className={wide ? 'w-full max-w-2xl' : 'w-full max-w-md'}>
        <div className="mb-6 flex justify-center">
          <Link to="/offers" className="rounded-xl bg-forest-900 px-5 py-3">
            <Logo />
          </Link>
        </div>
        <div className="rounded-card bg-white p-8 shadow-xl">
          <h1 className="text-2xl font-bold text-forest-900">{title}</h1>
          {subtitle && <p className="mt-2 text-sm leading-relaxed text-muted">{subtitle}</p>}
          <div className="mt-7">{children}</div>
        </div>
        {footer && <div className="mt-5 text-center text-sm text-muted">{footer}</div>}
      </div>
    </div>
  );
}
