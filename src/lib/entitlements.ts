/**
 * Source de vérité unique du rattachement "route de l'app -> module d'offre".
 * Utilisée par la sidebar, le garde de routes et la page Abonnement (DRY).
 */
export type ModuleKey =
  | "employees"
  | "departments"
  | "timeclock"
  | "leaves"
  | "contracts"
  | "recruitment"
  | "performance"
  | "talents"
  | "integrations";

export const MODULE_LABELS: Record<ModuleKey, string> = {
  employees: "Personnel",
  departments: "Départements",
  timeclock: "Pointage",
  leaves: "Congés",
  contracts: "Contrats",
  recruitment: "Recrutement",
  performance: "Performance",
  talents: "Talents",
  integrations: "Intégrations",
};

/** Modules toujours disponibles, quelle que soit l'offre. */
export const CORE_MODULES: ModuleKey[] = ["employees", "departments"];

/** Durée de l'essai gratuit, en jours, à compter de la création de l'organisation. */
export const TRIAL_DAYS = 30;

/** Offre Gratuit pendant l'essai : tout sauf Recrutement et Talents. */
export const TRIAL_MODULES: ModuleKey[] = [
  "employees",
  "departments",
  "timeclock",
  "leaves",
  "contracts",
  "performance",
  "integrations",
];

/** Offre Gratuit après l'essai. */
export const FREE_AFTER_TRIAL_MODULES: ModuleKey[] = ["employees", "departments"];

/** Fin de l'essai gratuit à partir de la date de création de l'organisation. */
export function trialEndsAt(createdAt: string | null | undefined): Date | null {
  if (!createdAt) return null;
  const start = new Date(createdAt).getTime();
  if (Number.isNaN(start)) return null;
  return new Date(start + TRIAL_DAYS * 24 * 60 * 60 * 1000);
}

/** L'organisation est-elle encore dans ses 30 premiers jours ? */
export function isTrialActive(createdAt: string | null | undefined): boolean {
  const end = trialEndsAt(createdAt);
  return !!end && end.getTime() > Date.now();
}

/** Modules effectifs de l'offre Gratuit selon l'essai. */
export function freeModules(createdAt: string | null | undefined): ModuleKey[] {
  return isTrialActive(createdAt) ? TRIAL_MODULES : FREE_AFTER_TRIAL_MODULES;
}

/** Ordre des offres, du plus petit au plus grand. */
export const PLAN_ORDER = ["gratuit", "essentiel", "professionnel", "entreprise"] as const;

export const PLAN_LABELS: Record<string, string> = {
  gratuit: "Gratuit",
  essentiel: "Essentiel",
  professionnel: "Professionnel",
  entreprise: "Entreprise",
};

/**
 * Modules inclus par offre payante. L'offre Gratuit est volontairement listée
 * hors essai : c'est cette échelle qui détermine l'offre à souscrire.
 */
export const PLAN_MODULES: Record<string, ModuleKey[]> = {
  gratuit: FREE_AFTER_TRIAL_MODULES,
  essentiel: ["employees", "departments", "timeclock", "leaves", "contracts"],
  professionnel: [
    "employees",
    "departments",
    "timeclock",
    "leaves",
    "contracts",
    "recruitment",
    "performance",
  ],
  entreprise: [
    "employees",
    "departments",
    "timeclock",
    "leaves",
    "contracts",
    "recruitment",
    "performance",
    "talents",
    "integrations",
  ],
};

/** Offre minimale qui débloque un module donné. */
export function requiredPlanFor(module: ModuleKey): string {
  return PLAN_ORDER.find((code) => PLAN_MODULES[code]?.includes(module)) ?? "entreprise";
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
  { path: "/app/contracts", module: "contracts" },
  { path: "/app/settings/integrations", module: "integrations" },
  { path: "/app/timeclock", module: "timeclock" },
  { path: "/app/departments", module: "departments" },
  { path: "/app/employees", module: "employees" },
];

/** Module requis pour ouvrir un chemin de l'app, ou null si le chemin est libre. */
export function moduleForPath(path: string): ModuleKey | null {
  const hit = ROUTE_MODULES.find((r) => path === r.path || path.startsWith(r.path + "/"));
  return hit ? hit.module : null;
}
