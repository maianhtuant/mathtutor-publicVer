import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

import { api, getToken, setToken, setUnauthorizedHandler } from './api';
import type { TokenResponse, User } from './types';

interface AuthState {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (email: string, password: string, fullName: string) => Promise<User>;
  logout: () => void;
  /** Reload the signed-in user (e.g. after editing the profile). */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    window.location.hash = '#/login';
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!getToken()) {
      setReady(true);
      return;
    }
    api.get<User>('/me').then(setUser).catch(() => setToken(null)).finally(() => setReady(true));
  }, [logout]);

  const accept = (r: TokenResponse) => {
    setToken(r.token);
    setUser(r.user);
    return r.user;
  };

  const value: AuthState = {
    user,
    ready,
    logout,
    refresh: async () => setUser(await api.get<User>('/me')),
    login: async (email, password) => accept(await api.post<TokenResponse>('/auth/login', { email, password })),
    register: async (email, password, fullName) =>
      accept(await api.post<TokenResponse>('/auth/register', { email, password, fullName })),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
