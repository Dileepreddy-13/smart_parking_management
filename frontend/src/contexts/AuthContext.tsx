import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import { api, type Session } from '../api';
import { setSessionExpiredHandler, tokenStore } from '../api/client';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  /** True until we know whether a stored token is still valid. */
  loading: boolean;
  isAdmin: boolean;
  signIn: (session: Session) => void;
  signOut: () => Promise<void>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(() => Boolean(tokenStore.get()));

  const clear = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  // Restore the session from a stored token on first load.
  useEffect(() => {
    if (!tokenStore.get()) return;
    api
      .me()
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  // Any request that reports an expired/invalid token signs the user out once.
  useEffect(() => {
    setSessionExpiredHandler((reason) => {
      clear();
      toast.error(reason, { id: 'session' });
    });
    return () => {
      setSessionExpiredHandler(undefined);
    };
  }, [clear]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      isAdmin: user?.role === 'ADMIN',
      signIn: (session) => {
        tokenStore.set(session.token);
        queryClient.clear();
        setUser(session.user);
      },
      signOut: async () => {
        await api.logout();
        clear();
      },
      setUser,
    }),
    [user, loading, queryClient, clear],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
