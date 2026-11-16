import { useQueryClient } from "@tanstack/react-query";
import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiRequest, refreshSession, setAccessToken, type AuthResponse, type AuthUser } from "../lib/api";
import { AuthContext, type AuthContextValue } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    let mounted = true;
    void refreshSession()
      .then((result) => { if (mounted) setUser(result.user); })
      .catch(() => { if (mounted) setUser(null); })
      .finally(() => { if (mounted) setIsLoading(false); });

    return () => {
      mounted = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      signIn: async (email, password) => {
        const result = await apiRequest<AuthResponse>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
        });
        setAccessToken(result.accessToken);
        setUser(result.user);
      },
      signUp: async (email, password) => {
        const result = await apiRequest<AuthResponse>("/auth/register", {
          method: "POST",
          body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
        });
        setAccessToken(result.accessToken);
        setUser(result.user);
      },
      signOut: async () => {
        try {
          await apiRequest<void>("/auth/logout", { method: "POST" }, false);
        } finally {
          setAccessToken(null);
          setUser(null);
          queryClient.clear();
        }
      },
    }),
    [isLoading, queryClient, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
