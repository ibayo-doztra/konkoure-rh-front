import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/hooks/useOrg";
import { ALL_ROLES, type AppRole } from "@/lib/permissions";

interface RoleCtx {
  role: AppRole | null;
  roles: AppRole[];
  loading: boolean;
  isAdmin: boolean;
}

const Ctx = createContext<RoleCtx>({ role: null, roles: [], loading: true, isAdmin: false });

// Highest privilege first: the effective role is the strongest one held.
const PRIORITY: AppRole[] = [
  "owner",
  "hr_admin",
  "manager",
  "recruiter",
  "security_agent",
  "employee",
];

/** Roles in the active organization, from `GET /me`. UI hint only: the API enforces access. */
export function RoleProvider({ children }: { children: ReactNode }) {
  const { me, loading } = useAuth();
  const { org } = useOrg();

  const roles = useMemo<AppRole[]>(() => {
    const o = me?.organizations.find((x) => x.id === org?.id);
    return (o?.roles ?? []).filter((r) => ALL_ROLES.includes(r));
  }, [me, org?.id]);

  const role = PRIORITY.find((r) => roles.includes(r)) ?? (roles.length ? roles[0] : null);
  const isAdmin = role === "owner" || role === "hr_admin";

  return <Ctx.Provider value={{ role, roles, loading, isAdmin }}>{children}</Ctx.Provider>;
}

export function useRole() {
  return useContext(Ctx);
}
