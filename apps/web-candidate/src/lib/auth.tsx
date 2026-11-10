import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, ApiError, setAccessToken } from './api';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string | null;
  phone?: string | null;
  locale?: string | null;
  timezone?: string | null;
  roles: string[];
  permissions?: string[];
  twoFactorEnabled?: boolean;
}

export class OtpRequiredError extends Error {
  constructor() {
    super('OTP required');
    this.name = 'OtpRequiredError';
  }
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string, otp?: string) => Promise<void>;
  register: (data: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  acceptToken: (accessToken: string) => Promise<void>;
  setUser: (user: AuthUser | null) => void;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const me = await api.get<AuthUser>('/api/v1/auth/me');
      setUser(me);
    } catch {
      setUser(null);
      setAccessToken(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.post<{ accessToken: string; user?: AuthUser }>(
          '/api/v1/auth/refresh',
          {},
        );
        setAccessToken(res.accessToken);
        if (res.user) {
          setUser(res.user);
        } else {
          const me = await api.get<AuthUser>('/api/v1/auth/me');
          setUser(me);
        }
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string, otp?: string) => {
    const res = await api.post<{
      accessToken?: string;
      user?: AuthUser;
      requires2fa?: boolean;
    }>('/api/v1/auth/login', {
      email,
      password,
      otp,
    });
    if (res.requires2fa) {
      throw new OtpRequiredError();
    }
    if (!res.accessToken || !res.user) {
      throw new ApiError('Invalid login response', 500);
    }
    setAccessToken(res.accessToken);
    setUser(res.user);
  }, []);

  const register = useCallback(async (data: RegisterInput) => {
    const res = await api.post<{ accessToken: string; user: AuthUser }>('/api/v1/auth/register', {
      ...data,
      locale: 'en',
    });
    setAccessToken(res.accessToken);
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/api/v1/auth/logout');
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const acceptToken = useCallback(async (accessToken: string) => {
    setAccessToken(accessToken);
    try {
      const me = await api.get<AuthUser>('/api/v1/auth/me');
      setUser(me);
    } catch (e) {
      setAccessToken(null);
      setUser(null);
      throw e;
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      register,
      logout,
      refreshUser,
      acceptToken,
      setUser,
    }),
    [user, isLoading, login, register, logout, refreshUser, acceptToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
