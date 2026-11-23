import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  GraduationCap,
  UploadCloud,
  Bell,
  User as UserIcon,
  Building2,
  Users,
  UserCheck,
  CheckSquare,
  AlertTriangle,
  PlusCircle,
  LogOut,
  Search,
} from 'lucide-react';
import { useAuth } from '../../auth/useAuth';
import { apiRequest } from '../../api/client';

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
}

export const AppShell: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [searchValue, setSearchValue] = useState<string>('');

  // Poll notifications count every 30s as specified in design-plan §1.25
  useEffect(() => {
    let isMounted = true;
    async function fetchUnreadCount() {
      try {
        const res = await apiRequest<{ unread_count: number }>(
          '/svc/notifications/api/notifications/unread-count/'
        );
        if (isMounted) {
          setUnreadCount(res.unread_count || 0);
        }
      } catch {
        // Silent catch for poll
      }
    }

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const getNavItems = (): NavItem[] => {
    if (!user) return [];

    switch (user.role) {
      case 'student':
        return [
          { label: 'Dashboard', to: '/app/student', icon: <LayoutDashboard className="w-5 h-5" /> },
          { label: 'Browse Offers', to: '/app/student/offers', icon: <Briefcase className="w-5 h-5" /> },
          { label: 'My Applications', to: '/app/student/applications', icon: <FileText className="w-5 h-5" /> },
          { label: 'My Internship', to: '/app/student/internship', icon: <GraduationCap className="w-5 h-5" /> },
          { label: 'Final Submission', to: '/app/student/internship/submission', icon: <UploadCloud className="w-5 h-5" /> },
          { label: 'Notifications', to: '/app/student/notifications', icon: <Bell className="w-5 h-5" /> },
          { label: 'Profile', to: '/app/student/profile', icon: <UserIcon className="w-5 h-5" /> },
        ];
      case 'company':
        return [
          { label: 'Dashboard', to: '/app/company', icon: <LayoutDashboard className="w-5 h-5" /> },
          { label: 'Company Profile', to: '/app/company/profile', icon: <Building2 className="w-5 h-5" /> },
          { label: 'My Offers', to: '/app/company/offers', icon: <Briefcase className="w-5 h-5" /> },
          { label: 'Post Internship', to: '/app/company/offers/new', icon: <PlusCircle className="w-5 h-5" /> },
          { label: 'Incoming Requests', to: '/app/company/applications', icon: <FileText className="w-5 h-5" /> },
          { label: 'Cancellations', to: '/app/company/cancellations', icon: <AlertTriangle className="w-5 h-5" /> },
          { label: 'Notifications', to: '/app/company/notifications', icon: <Bell className="w-5 h-5" /> },
        ];
      case 'university_admin':
        return [
          { label: 'Dashboard', to: '/app/university', icon: <LayoutDashboard className="w-5 h-5" /> },
          { label: 'Students', to: '/app/university/students', icon: <Users className="w-5 h-5" /> },
          { label: 'Supervisors', to: '/app/university/supervisors', icon: <UserCheck className="w-5 h-5" /> },
          { label: 'Applications', to: '/app/university/applications', icon: <FileText className="w-5 h-5" /> },
          { label: 'Internships', to: '/app/university/internships', icon: <GraduationCap className="w-5 h-5" /> },
          { label: 'Cancellations', to: '/app/university/cancellations', icon: <AlertTriangle className="w-5 h-5" /> },
          { label: 'Notifications', to: '/app/university/notifications', icon: <Bell className="w-5 h-5" /> },
          { label: 'Profile', to: '/app/university/profile', icon: <UserIcon className="w-5 h-5" /> },
        ];
      case 'supervisor':
        return [
          { label: 'Dashboard', to: '/app/supervisor', icon: <LayoutDashboard className="w-5 h-5" /> },
          { label: 'My Students', to: '/app/supervisor/students', icon: <Users className="w-5 h-5" /> },
          { label: 'Notifications', to: '/app/supervisor/notifications', icon: <Bell className="w-5 h-5" /> },
          { label: 'Profile', to: '/app/supervisor/profile', icon: <UserIcon className="w-5 h-5" /> },
        ];
      case 'platform_admin':
        return [
          { label: 'Dashboard', to: '/app/platform', icon: <LayoutDashboard className="w-5 h-5" /> },
          { label: 'Company Verification', to: '/app/platform/companies', icon: <CheckSquare className="w-5 h-5" /> },
          { label: 'Create Accounts', to: '/app/platform/accounts/new', icon: <PlusCircle className="w-5 h-5" /> },
          { label: 'Profile', to: '/app/platform/profile', icon: <UserIcon className="w-5 h-5" /> },
        ];
      default:
        return [];
    }
  };

  const getInitials = (name: string): string => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const getRoleLabel = (role?: string): string => {
    switch (role) {
      case 'student':
        return 'Student';
      case 'company':
        return 'Company';
      case 'university_admin':
        return 'University Admin';
      case 'supervisor':
        return 'Supervisor';
      case 'platform_admin':
        return 'Platform Admin';
      default:
        return 'User';
    }
  };

  const notificationsUrl = `/app/${user?.role}/notifications`;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-canvas">
      {/* 300px Fixed Sidebar in Forest 900 */}
      <aside className="w-[300px] shrink-0 h-full bg-forest-900 text-inverseText flex flex-col justify-between select-none">
        <div>
          {/* Logo & Header Tile */}
          <div className="p-6 border-b border-surface-700/60 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-surface-600 flex items-center justify-center font-bold text-mint text-xl shadow-xs">
              SL
            </div>
            <div>
              <div className="font-bold text-lg tracking-wider text-inverseText">
                STAGELINK
              </div>
              <div className="text-[11px] text-sage font-normal leading-tight">
                University Internship Platform
              </div>
            </div>
          </div>

          {/* Navigation List */}
          <nav className="p-4 space-y-1 overflow-y-auto max-h-[calc(100vh-170px)]">
            {getNavItems().map((item) => {
              const isActive =
                item.to === `/app/${user?.role}`
                  ? location.pathname === item.to
                  : location.pathname.startsWith(item.to);

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-3 px-3.5 h-11 rounded-lg text-[13px] font-medium transition-colors ${
                    isActive
                      ? 'bg-surface-600 text-inverseText shadow-xs'
                      : 'text-sage hover:bg-surface-700/70 hover:text-inverseText'
                  }`}
                >
                  <span className="shrink-0">{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Bottom Profile Block */}
        <div className="p-4 border-t border-surface-700/60 bg-forest-800/40 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-surface-600 text-inverseText font-semibold text-xs flex items-center justify-center shrink-0 border border-sage/30">
              {getInitials(user?.name || '')}
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-inverseText truncate">
                {user?.name || 'User'}
              </div>
              <div className="text-[11px] text-sage truncate">
                {getRoleLabel(user?.role)}
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            className="p-1.5 text-sage hover:text-white rounded-lg hover:bg-surface-700/70 transition-colors ml-2"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Bar */}
        <header className="h-16 px-8 bg-white border-b border-mint-200/80 flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-forest-900 tracking-tight truncate">
              {location.pathname.split('/').pop()?.replace(/-/g, ' ').toUpperCase() || 'STAGELINK'}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Search Input (capped at 360px per design-plan §2) */}
            <div className="relative w-72 max-w-[360px]">
              <Search className="w-4 h-4 text-mutedText absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-canvas border border-mint-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-surface-600 focus:border-transparent text-forest-900 placeholder:text-mutedText"
              />
            </div>

            {/* Notification Bell */}
            <button
              onClick={() => navigate(notificationsUrl)}
              className="relative p-2 text-forest-900 hover:bg-mint-100 rounded-lg transition-colors cursor-pointer"
              title="Notifications"
            >
              <Bell className="w-5 h-5 text-surface-700" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-600 ring-2 ring-white" />
              )}
            </button>
          </div>
        </header>

        {/* Scrollable Content (max 1140px width, 48px padding) */}
        <main className="flex-1 overflow-y-auto p-12">
          <div className="max-w-content mx-auto w-full">
            <Outlet context={{ search: searchValue }} />
          </div>
        </main>
      </div>
    </div>
  );
};
