import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getAccessToken,
  getOrganizationId,
  onApiEvent,
  refreshSession,
  setAccessToken,
  setOrganizationId,
} from "@/lib/api/client";
import { fetchMe, login as apiLogin, logout as apiLogout, meQueryKey } from "@/lib/api/auth";
import type { AuthUser, Me } from "@/lib/api/types";

const ACTIVE_ORGANIZATION_KEY = "konkoure.org";

function readStoredOrganization(): string | null {
  try {
    return localStorage.getItem(ACTIVE_ORGANIZATION_KEY);
  } catch {
    return null;
  }
}

function storeOrganization(id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_ORGANIZATION_KEY, id);
    else localStorage.removeItem(ACTIVE_ORGANIZATION_KEY);
  } catch {
    /* ignore */
  }
}

interface AuthCtx {
  user: AuthUser | null;
  /** Full `GET /me` payload (organizations, roles, employee, subscription, modules). */
  me: Me | null;
  /** Organization chosen by the client: the API never picks one (01 §4). */
  activeOrganizationId: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  /** Re-reads `/me` (after onboarding, profile change, plan change…). */
  reload: () => Promise<Me | null>;
  selectOrganization: (id: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  me: null,
  activeOrganizationId: null,
  loading: true,
  signIn: async () => {},
  reload: async () => null,
  selectOrganization: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [me, setMe] = useState<Me | null>(null);
  const [activeOrganizationId, setActiveOrganizationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      if (!getOrganizationId()) setOrganizationId(readStoredOrganization());
      let next = await fetchMe();
      const requested = getOrganizationId();
      const active =
        next.organizations.find((o) => o.id === requested)?.id ?? next.organizations[0]?.id ?? null;
      setOrganizationId(active);
      storeOrganization(active);
      // Rights are per organization: read them again for the one finally selected.
      if (active && active !== requested) next = await fetchMe();
      setActiveOrganizationId(active);
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
    setOrganizationId(null);
    setActiveOrganizationId(null);
    setMe(null);
    queryClient.clear();
    storeOrganization(null);
  }, [queryClient]);

  const selectOrganization = useCallback(
    async (id: string) => {
      setOrganizationId(id);
      storeOrganization(id);
      queryClient.clear();
      await reload();
    },
    [queryClient, reload],
  );

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
    <Ctx.Provider
      value={{
        user: me?.user ?? null,
        me,
        activeOrganizationId,
        loading,
        signIn,
        reload,
        selectOrganization,
        signOut,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
