import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { setOrganizationId } from "@/lib/api/client";
import type { Me } from "@/lib/api/types";

/** Legacy snake_case shape still consumed by the screens. */
export interface Organization {
  id: string;
  name: string;
  slug: string;
  default_language: string;
  default_currency: string;
  plan: string;
  performance_model?: "classic" | "sap";
  logo_url?: string | null;
}

interface OrgCtx {
  org: Organization | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const Ctx = createContext<OrgCtx>({ org: null, loading: true, refresh: async () => {} });

function activeOrganization(me: Me | null): Organization | null {
  if (!me) return null;
  // The API never picks the active organization (01 §4): the client does.
  // Multi-organization switching is not built yet, so the first one is used.
  const o = me.organizations[0] ?? null;
  if (!o) return null;
  return {
    id: o.id,
    name: o.name,
    slug: o.slug,
    default_language: o.defaultLanguage,
    default_currency: o.defaultCurrency,
    // null until the billing module fills it (06 §2).
    plan: o.plan ?? "",
    performance_model: o.performanceModel,
    logo_url: o.logoUrl,
  };
}

/** Active organization, derived from `GET /me`. Drives the `X-Organization-Id` header. */
export function OrgProvider({ children }: { children: ReactNode }) {
  const { me, loading, reload } = useAuth();
  const org = useMemo(() => activeOrganization(me), [me]);

  useEffect(() => {
    setOrganizationId(org?.id ?? null);
  }, [org?.id]);

  const refresh = async () => {
    await reload();
  };

  return <Ctx.Provider value={{ org, loading, refresh }}>{children}</Ctx.Provider>;
}

export function useOrg() {
  return useContext(Ctx);
}
