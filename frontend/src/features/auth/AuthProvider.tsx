import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { refreshSession } from '@/api/http';
import { getMe, login as apiLogin, logout as apiLogout, type UserProfile } from '@/api/identity';
import { ApiError } from '@/lib/errors';
import { isRole, type Role } from '@/lib/roles';
import {
  clearTokens,
  getRefreshToken,
  onSessionExpired,
  setTokens,
} from '@/lib/session';

export type AuthUser = Omit<UserProfile, 'role'> & { role: Role };
export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export interface AuthContextValue {
  user: AuthUser | null;
  role: Role | null;
  status: AuthStatus;
  login(email: string, password: string): Promise<AuthUser>;
  logout(): Promise<void>;
  refreshUser(): Promise<void>;
  /** Clear local session without calling the API (e.g. after a password change). */
  clearLocalSession(): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toAuthUser(profile: UserProfile): AuthUser {
  if (!isRole(profile.role)) {
    throw new ApiError({ status: 0, message: `Unsupported account role: ${String(profile.role)}` });
  }
  return { ...profile, role: profile.role };
}

// Bootstrap once per page load (React StrictMode runs effects twice in dev).
let bootstrapPromise: Promise<AuthUser | null> | null = null;
function bootstrapSession(): Promise<AuthUser | null> {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      if (!getRefreshToken()) return null;
      if (!(await refreshSession())) {
        clearTokens();
        return null;
      }
      try {
        return toAuthUser(await getMe());
      } catch {
        clearTokens();
        return null;
      }
    })();
  }
  return bootstrapPromise;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  const setAnonymous = useCallback(() => {
    setUser(null);
    setStatus('anonymous');
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    let active = true;
    void bootstrapSession().then((restored) => {
      if (!active) return;
      if (restored) {
        setUser(restored);
        setStatus('authenticated');
      } else {
        setStatus('anonymous');
      }
    });
    const unsubscribe = onSessionExpired(setAnonymous);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [setAnonymous]);

  const login = useCallback(async (email: string, password: string) => {
    const pair = await apiLogin(email, password);
    const nextUser = toAuthUser(pair.user);
    setTokens({ access: pair.access, refresh: pair.refresh });
    bootstrapPromise = Promise.resolve(nextUser);
    setUser(nextUser);
    setStatus('authenticated');
    return nextUser;
  }, []);

  const logout = useCallback(async () => {
    const refresh = getRefreshToken();
    clearTokens();
    bootstrapPromise = Promise.resolve(null);
    setAnonymous();
    if (refresh) {
      try {
        await apiLogout(refresh);
      } catch {
        /* logout is idempotent; local session is already gone */
      }
    }
  }, [setAnonymous]);

  const refreshUser = useCallback(async () => {
    setUser(toAuthUser(await getMe()));
  }, []);

  const clearLocalSession = useCallback(() => {
    clearTokens();
    bootstrapPromise = Promise.resolve(null);
    setAnonymous();
  }, [setAnonymous]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role: user?.role ?? null,
      status,
      login,
      logout,
      refreshUser,
      clearLocalSession,
    }),
    [user, status, login, logout, refreshUser, clearLocalSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
