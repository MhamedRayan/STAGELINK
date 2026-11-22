import { Link } from 'react-router-dom';
import { ROUTES } from './routes';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3">
      <h1 className="text-page-title text-forest-900">Page not found</h1>
      <Link to={ROUTES.root} className="text-surface-600 underline">
        Go to the start page
      </Link>
    </div>
  );
}
