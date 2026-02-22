import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { clearTokens, getAccessToken, setTokens } from "../api/client";
import type { AuthTokens, AuthUser } from "../types";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const profile = await api.me();
      setUser(profile);
    } catch {
      setUser(null);
      clearTokens();
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      if (getAccessToken()) {
        await refreshUser();
      }
      setLoading(false);
    };
    void bootstrap();
  }, []);

  const login = async (email: string, password: string) => {
    const tokens: AuthTokens = await api.login(email, password);
    setTokens(tokens);
    const profile = await api.me();
    setUser(profile);
    return profile;
  };

  const logout = () => {
    clearTokens();
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      refreshUser,
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
