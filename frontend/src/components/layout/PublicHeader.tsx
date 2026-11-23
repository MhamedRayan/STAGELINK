import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { Button } from '../ui/Button';

export const PublicHeader: React.FC = () => {
  const { user, isAuthenticated, getDashboardRoute } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="h-16 px-8 bg-forest-900 text-inverseText flex items-center justify-between border-b border-surface-700">
      <Link to="/" className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-surface-600 flex items-center justify-center font-bold text-mint text-lg">
          SL
        </div>
        <div className="font-bold text-lg tracking-wider text-inverseText">
          STAGELINK
        </div>
      </Link>

      <nav className="flex items-center gap-6">
        <Link
          to="/offers"
          className="text-sm font-medium text-sage hover:text-inverseText transition-colors"
        >
          Browse Offers
        </Link>

        {isAuthenticated && user ? (
          <Button
            size="sm"
            onClick={() => navigate(getDashboardRoute(user.role))}
            className="bg-surface-600 hover:bg-surface-700"
          >
            Go to Dashboard
          </Button>
        ) : (
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => navigate('/login')}
              className="text-sage hover:text-inverseText hover:bg-surface-700/60"
            >
              Log in
            </Button>
            <Button
              size="sm"
              onClick={() => navigate('/register/company')}
              className="bg-mint text-forest-900 hover:bg-mint-300 font-semibold"
            >
              Post Internship
            </Button>
          </div>
        )}
      </nav>
    </header>
  );
};
