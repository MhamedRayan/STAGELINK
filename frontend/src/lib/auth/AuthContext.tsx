import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { identityApi } from '@/lib/api/identity';
import {
  clearTokens,
  getRefreshToken,
  setTokens,
  subscribeSessionExpired,
} from '@/lib/api/tokens';
import type { Role, User } from '@/lib/api/types';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  role: Role | null;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      if (!getRefreshToken()) {
        setStatus('anonymous');
        return;
      }
      try {
        const me = await identityApi.me();
        if (cancelled) return;
        setUser(me);
        setStatus('authenticated');
      } catch {
        if (cancelled) return;
        clearTokens();
        setUser(null);
        setStatus('anonymous');
      }
    }
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(
    () =>
      subscribeSessionExpired(() => {
        setUser(null);
        setStatus('anonymous');
      }),
    [],
  );

  const login = useCallback(async (email: string, password: string) => {
    const tokens = await identityApi.login(email, password);
    setTokens({ access: tokens.access, refresh: tokens.refresh });
    setUser(tokens.user);
    setStatus('authenticated');
    return tokens.user;
  }, []);

  const logout = useCallback(async () => {
    const refresh = getRefreshToken();
    if (refresh) {
      try {
        await identityApi.logout(refresh);
      } catch {
        /* the local session is cleared regardless */
      }
    }
    clearTokens();
    setUser(null);
    setStatus('anonymous');
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const me = await identityApi.me();
      setUser(me);
      return me;
    } catch {
      return null;
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      role: user?.role ?? null,
      login,
      logout,
      refreshUser,
    }),
    [status, user, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
