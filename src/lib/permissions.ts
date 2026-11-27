export type AppRole =
  "owner" | "hr_admin" | "manager" | "employee" | "recruiter" | "security_agent";

export const ALL_ROLES: AppRole[] = [
  "owner",
  "hr_admin",
  "manager",
  "employee",
  "recruiter",
  "security_agent",
];

export const ROLE_LABELS: Record<AppRole, string> = {
  owner: "Propriétaire",
  hr_admin: "RH",
  manager: "Manager",
  employee: "Employé",
  recruiter: "Recruteur",
  security_agent: "Agent de sécurité",
};

const ADMINS: AppRole[] = ["owner", "hr_admin"];

interface Rule {
  path: string;
  exact?: boolean;
  roles: AppRole[];
}

/**
 * Ordered from the most specific path to the least specific one.
 * The first matching rule wins.
 */
const RULES: Rule[] = [
  { path: "/app", exact: true, roles: ALL_ROLES },

  { path: "/app/employees", exact: true, roles: [...ADMINS, "manager"] },
  // Employee detail pages stay reachable (an employee can open their own file).
  { path: "/app/employees", roles: ALL_ROLES },

  { path: "/app/departments", roles: [...ADMINS, "manager"] },
  // Un employé accède à la page contrats : elle est filtrée sur son propre contrat.
  { path: "/app/contracts", roles: ALL_ROLES },

  // Scoring webhook (secret, outbound URLs): owner and hr_admin only.
  { path: "/app/recruitment/scoring", roles: ADMINS },
  { path: "/app/recruitment", roles: [...ADMINS, "recruiter"] },

  { path: "/app/performance", roles: ALL_ROLES },

  { path: "/app/timeclock/zones", roles: [...ADMINS, "security_agent"] },
  // Kiosk tokens let a tablet punch for everyone: owner and hr_admin only.
  { path: "/app/timeclock/kiosks", roles: ADMINS },
  // Badge journal (06 §6): owner and hr_admin only.
  { path: "/app/timeclock/badges", roles: ADMINS },
  { path: "/app/timeclock/scan", roles: [...ADMINS, "security_agent", "manager"] },
  // Historique de pointage : chacun voit au minimum le sien.
  { path: "/app/timeclock/logs", roles: ALL_ROLES },
  { path: "/app/timeclock", roles: [...ADMINS, "manager", "security_agent"] },

  { path: "/app/leaves/holidays", roles: ADMINS },
  { path: "/app/leaves", roles: ALL_ROLES },

  { path: "/app/talents/succession", roles: ADMINS },
  // 9-box and skills matrix: a manager reads their team.
  { path: "/app/talents", roles: [...ADMINS, "manager"] },

  { path: "/app/settings", roles: ADMINS },
  { path: "/app/billing", roles: ["owner"] },
];

function matches(rule: Rule, path: string): boolean {
  if (rule.exact) return path === rule.path;
  return path === rule.path || path.startsWith(rule.path + "/");
}

/** Returns true when the given role may open the given in-app path. */
export function canAccess(path: string, role: AppRole | null): boolean {
  if (!role) return false;
  const rule = RULES.find((r) => matches(r, path));
  if (!rule) return true; // unknown path: no restriction
  return rule.roles.includes(role);
}
