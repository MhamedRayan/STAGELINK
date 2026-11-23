import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, UserRole, LoginResponse, RefreshResponse } from '../types/auth';
import {
  apiRequest,
  setTokens,
  clearTokens,
  getRefreshToken,
  setAuthFailureHandler,
} from '../api/client';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  registerCompany: (data: {
    email: string;
    name: string;
    password: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (current_password: string, new_password: string) => Promise<void>;
  updateUser: (partialUser: Partial<User>) => void;
  getDashboardRoute: (role?: UserRole) => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_STORAGE_KEY = 'stagelink_cached_user';

export function getRoleDashboard(role?: UserRole): string {
  switch (role) {
    case 'student':
      return '/app/student';
    case 'company':
      return '/app/company';
    case 'university_admin':
      return '/app/university';
    case 'supervisor':
      return '/app/supervisor';
    case 'platform_admin':
      return '/app/platform';
    default:
      return '/offers';
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem(USER_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const handleLogout = useCallback(async () => {
    const refresh = getRefreshToken();
    if (refresh) {
      try {
        await apiRequest('/svc/identity/api/auth/logout/', {
          method: 'POST',
          body: JSON.stringify({ refresh }),
        });
      } catch {
        // Idempotent logout
      }
    }
    clearTokens();
    localStorage.removeItem(USER_STORAGE_KEY);
    setUser(null);
  }, []);

  useEffect(() => {
    setAuthFailureHandler(() => {
      clearTokens();
      localStorage.removeItem(USER_STORAGE_KEY);
      setUser(null);
    });
  }, []);

  // Initialize auth on boot
  useEffect(() => {
    let mounted = true;
    async function initSession() {
      const refresh = getRefreshToken();
      if (!refresh) {
        if (mounted) setIsLoading(false);
        return;
      }

      try {
        const refreshData = await apiRequest<RefreshResponse>(
          '/svc/identity/api/auth/refresh/',
          {
            method: 'POST',
            body: JSON.stringify({ refresh }),
          }
        );
        setTokens({ access: refreshData.access, refresh: refreshData.refresh });

        const userData = await apiRequest<User>('/svc/identity/api/users/me/', {
          method: 'GET',
        });

        if (mounted) {
          setUser(userData);
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
        }
      } catch {
        if (mounted) {
          clearTokens();
          localStorage.removeItem(USER_STORAGE_KEY);
          setUser(null);
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    initSession();
    return () => {
      mounted = false;
    };
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    const res = await apiRequest<LoginResponse>('/svc/identity/api/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    setTokens({ access: res.access, refresh: res.refresh });
    setUser(res.user);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(res.user));
    return res.user;
  };

  const registerCompany = async (data: {
    email: string;
    name: string;
    password: string;
  }): Promise<void> => {
    await apiRequest('/svc/identity/api/auth/register/', {
      method: 'POST',
      body: JSON.stringify({ ...data, role: 'company' }),
    });
  };

  const changePassword = async (
    current_password: string,
    new_password: string
  ): Promise<void> => {
    await apiRequest('/svc/identity/api/users/me/password/', {
      method: 'POST',
      body: JSON.stringify({ current_password, new_password }),
    });
    // Password change revokes all refresh tokens
    clearTokens();
    localStorage.removeItem(USER_STORAGE_KEY);
    setUser(null);
  };

  const updateUser = (partialUser: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...partialUser };
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    registerCompany,
    logout: handleLogout,
    changePassword,
    updateUser,
    getDashboardRoute: (r?: UserRole) => getRoleDashboard(r || user?.role),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
