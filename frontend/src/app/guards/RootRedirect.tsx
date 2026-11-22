import { Navigate } from 'react-router-dom';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { useAuth } from '@/features/auth/AuthProvider';
import { ROLE_HOME, ROUTES } from '../routes';

/** `/` → role dashboard when logged in, otherwise the public offers list. */
export function RootRedirect() {
  const { status, role } = useAuth();
  if (status === 'loading') return <FullPageSpinner />;
  return <Navigate to={role ? ROLE_HOME[role] : ROUTES.guest.offers} replace />;
}
