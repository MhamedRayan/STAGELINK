import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { useAuth } from '@/features/auth/AuthProvider';
import type { Role } from '@/lib/roles';
import { ROLE_HOME, ROUTES } from '../routes';

/** Guards an `/app/*` subtree: anonymous → login, wrong role → that role's dashboard. */
export function RequireRole({ role: required }: { role: Role }) {
  const { status, role } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageSpinner />;
  if (!role) return <Navigate to={ROUTES.login} replace state={{ from: location.pathname }} />;
  if (role !== required) return <Navigate to={ROLE_HOME[role]} replace />;
  return <Outlet />;
}
