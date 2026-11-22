import { Navigate, Outlet } from 'react-router-dom';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { useAuth } from '@/features/auth/AuthProvider';
import { ROLE_HOME } from '../routes';

/** Public routes bounce authenticated users to their dashboard (design-plan §2). */
export function PublicOnly() {
  const { status, role } = useAuth();
  if (status === 'loading') return <FullPageSpinner />;
  if (role) return <Navigate to={ROLE_HOME[role]} replace />;
  return <Outlet />;
}
