import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getAccessToken, onApiEvent, refreshSession, setAccessToken } from "@/lib/api/client";
import { fetchMe, login as apiLogin, logout as apiLogout, meQueryKey } from "@/lib/api/auth";
import type { AuthUser, Me } from "@/lib/api/types";

interface AuthCtx {
  user: AuthUser | null;
  /** Full `GET /me` payload (organizations, roles, employee, subscription, modules). */
  me: Me | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  /** Re-reads `/me` (after onboarding, profile change, plan change…). */
  reload: () => Promise<Me | null>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  me: null,
  loading: true,
  signIn: async () => {},
  reload: async () => null,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const next = await fetchMe();
      setMe(next);
      queryClient.setQueryData(meQueryKey, next);
      return next;
    } catch {
      setMe(null);
      return null;
    }
  }, [queryClient]);

  // Expired session: clear everything locally and let the route guard send the
  // user to /login — never surface a "permission denied" message.
  const forceLocalSignOut = useCallback(() => {
    setAccessToken(null);
    setMe(null);
    queryClient.clear();
    try {
      localStorage.removeItem("konkoure.org");
    } catch {
      /* ignore */
    }
  }, [queryClient]);

  // Restore the session from the httpOnly refresh cookie on first load.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ok = getAccessToken() !== null || (await refreshSession());
      if (cancelled) return;
      if (ok) await reload();
      if (!cancelled) setLoading(false);
    })();
    const off = onApiEvent("unauthorized", forceLocalSignOut);
    return () => {
      cancelled = true;
      off();
    };
  }, [reload, forceLocalSignOut]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      await apiLogin({ email, password });
      await reload();
    },
    [reload],
  );

  const signOut = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      /* the local session is cleared regardless */
    }
    forceLocalSignOut();
  }, [forceLocalSignOut]);

  return (
    <Ctx.Provider value={{ user: me?.user ?? null, me, loading, signIn, reload, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
