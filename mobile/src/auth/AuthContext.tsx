import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, setAuthToken, setUnauthorizedHandler } from '../api/client';
import { clearAuth, loadAuth, saveAuth, type StoredUser } from '../storage/auth';

type Role = 'worker' | 'manager' | 'admin';
type Site = 'hq'|'jeonju'|'busan';
type User = { id: string; name: string; role: Role; site?: Site; team?: string; teamDetail?: string | null };

type AuthContextType = {
  user: User | null;
  token: string | null;
  registering: boolean;
  loggingIn: boolean;
  login: (name: string) => Promise<void>;
  register: (name: string, role: Role, site: Site, team: string, teamDetail?: string | null) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    (async () => {
      const { token, user } = await loadAuth();
      if (token) {
        setAuthToken(token);
        setToken(token);
      }
      if (user) setUser(user as User);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    // 401 응답 시 자동 로그아웃
    setUnauthorizedHandler(() => logout());
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = async (name: string) => {
    setLoggingIn(true);
    try {
      console.log('[Auth] Sending login request', { name });
      const res = await api.post('/api/auth/login', { name });
      console.log('[Auth] Login response', res.data);
      setUser(res.data.user);
      setToken(res.data.token);
      setAuthToken(res.data.token);
      await saveAuth(res.data.token, res.data.user as StoredUser);
    } catch (e) {
      const err = e as any;
      console.error('[Auth] Login error', err?.message || err, err?.response?.data);
      throw e;
    } finally {
      setLoggingIn(false);
    }
  };

  const register = async (name: string, role: Role, site: Site, team: string, teamDetail?: string | null) => {
    setRegistering(true);
    try {
      const payload: any = { name, role, site, team };
      if (teamDetail) payload.teamDetail = teamDetail;
      const res = await api.post('/api/auth/register', payload);
      setUser(res.data.user);
      setToken(res.data.token);
      setAuthToken(res.data.token);
      await saveAuth(res.data.token, res.data.user as StoredUser);
    } finally {
      setRegistering(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setAuthToken(null);
    clearAuth();
  };

  const value = useMemo(() => ({ user, token, registering, loggingIn, login, register, logout }), [user, token, registering, loggingIn]);
  if (loading) return null;
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
