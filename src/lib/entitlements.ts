/**
 * Source de vérité unique du rattachement "route de l'app -> module d'offre".
 * Identifiants et offres : konkoure-rh-api/docs/backend/07 §6 et 03 §6. Le serveur
 * décide des droits ; ces tables servent seulement à masquer et à présenter l'offre.
 */
export type ModuleKey =
  | "hr"
  | "timeclock"
  | "leaves"
  | "performance"
  | "recruitment"
  | "talents"
  | "settings"
  | "integrations"
  | "api";

export const MODULE_LABELS: Record<ModuleKey, string> = {
  hr: "Ressources humaines",
  timeclock: "Pointage",
  leaves: "Congés",
  performance: "Performance",
  recruitment: "Recrutement",
  talents: "Talents",
  settings: "Paramètres",
  integrations: "Intégrations",
  api: "API",
};

/** Après l'essai, l'offre Gratuit ne conserve que les RH, en lecture seule. */
export const FREE_AFTER_TRIAL_MODULES: ModuleKey[] = ["hr"];

const CORE_PAID_MODULES: ModuleKey[] = ["hr", "timeclock", "leaves", "performance", "settings"];

/** Ordre des offres, du plus petit au plus grand. */
export const PLAN_ORDER = ["free", "starter", "pro", "enterprise"] as const;

export const PLAN_LABELS: Record<string, string> = {
  free: "Gratuit",
  starter: "Starter",
  pro: "Pro",
  enterprise: "Entreprise",
};

/**
 * Modules inclus par offre. L'offre Gratuit est volontairement listée hors essai :
 * c'est cette échelle qui détermine l'offre à souscrire.
 */
export const PLAN_MODULES: Record<string, ModuleKey[]> = {
  free: FREE_AFTER_TRIAL_MODULES,
  starter: CORE_PAID_MODULES,
  pro: [...CORE_PAID_MODULES, "recruitment", "talents", "integrations"],
  enterprise: [...CORE_PAID_MODULES, "recruitment", "talents", "integrations", "api"],
};

/** Offre minimale qui débloque un module donné. */
export function requiredPlanFor(module: ModuleKey): string {
  return PLAN_ORDER.find((code) => PLAN_MODULES[code]?.includes(module)) ?? "enterprise";
}

interface RouteModule {
  path: string;
  module: ModuleKey;
}

/** Du chemin le plus précis au plus général : la première correspondance gagne. */
const ROUTE_MODULES: RouteModule[] = [
  { path: "/app/recruitment", module: "recruitment" },
  { path: "/app/performance", module: "performance" },
  { path: "/app/talents", module: "talents" },
  { path: "/app/leaves", module: "leaves" },
  { path: "/app/contracts", module: "hr" },
  { path: "/app/settings/integrations", module: "integrations" },
  { path: "/app/timeclock", module: "timeclock" },
  { path: "/app/departments", module: "hr" },
  { path: "/app/employees", module: "hr" },
];

/** Module requis pour ouvrir un chemin de l'app, ou null si le chemin est libre. */
export function moduleForPath(path: string): ModuleKey | null {
  const hit = ROUTE_MODULES.find((r) => path === r.path || path.startsWith(r.path + "/"));
  return hit ? hit.module : null;
}
