import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@/types/models';
import { authApi } from '@/services/api';
import { PageSpinner } from '@/components/ui/Spinner';
import { queryClient } from './queryClient';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);

  // The httpOnly `access_token` cookie (if any) rides along with this
  // request automatically — there's no client-side session to restore.
  useEffect(() => {
    authApi
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setBootstrapping(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const loggedInUser = await authApi.login(email, password);
    // Query keys (e.g. the claims list) don't include the user id, so a
    // cached response from the previous session could otherwise be served
    // to the newly signed-in user within `staleTime` — clear it on every
    // account switch within the same tab.
    queryClient.clear();
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    queryClient.clear();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isAuthenticated: !!user, login, logout }),
    [user, login, logout],
  );

  if (bootstrapping) {
    return <PageSpinner label="Loading your session…" />;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
