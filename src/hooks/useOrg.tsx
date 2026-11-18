import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { Me, MeOrganization } from "@/lib/api/types";

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
  organizations: MeOrganization[];
  loading: boolean;
  refresh: () => Promise<void>;
  selectOrganization: (id: string) => Promise<void>;
}

const Ctx = createContext<OrgCtx>({
  org: null,
  organizations: [],
  loading: true,
  refresh: async () => {},
  selectOrganization: async () => {},
});

function activeOrganization(me: Me | null, id: string | null): Organization | null {
  const o = me?.organizations.find((candidate) => candidate.id === id);
  if (!o) return null;
  return {
    id: o.id,
    name: o.name,
    slug: o.slug,
    default_language: o.defaultLanguage,
    default_currency: o.defaultCurrency,
    plan: o.plan ?? "",
    performance_model: o.performanceModel,
    logo_url: o.logoUrl,
  };
}

/** Active organization, derived from `GET /me`. Drives the `X-Organization-Id` header. */
export function OrgProvider({ children }: { children: ReactNode }) {
  const { me, activeOrganizationId, loading, reload, selectOrganization } = useAuth();
  const org = useMemo(
    () => activeOrganization(me, activeOrganizationId),
    [me, activeOrganizationId],
  );
  const organizations = me?.organizations ?? [];

  const refresh = async () => {
    await reload();
  };

  return (
    <Ctx.Provider value={{ org, organizations, loading, refresh, selectOrganization }}>
      {children}
    </Ctx.Provider>
  );
}

export function useOrg() {
  return useContext(Ctx);
}
