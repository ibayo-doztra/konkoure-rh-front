// Mémorise l'offre choisie depuis la landing pour reprendre le paiement
// après inscription / création de l'organisation.
export type PendingCycle = "mensuel" | "annuel";
export type PendingPlanCode = "starter" | "pro" | "enterprise";

const KEY = "konkoure.pendingPlan";

export interface PendingPlan {
  plan: PendingPlanCode;
  cycle: PendingCycle;
}

export function savePendingPlan(value: PendingPlan) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

/** Lit puis efface l'offre mémorisée. */
export function takePendingPlan(): PendingPlan | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingPlan;
    if (!["starter", "pro", "enterprise"].includes(parsed.plan)) return null;
    return { plan: parsed.plan, cycle: parsed.cycle === "annuel" ? "annuel" : "mensuel" };
  } catch {
    return null;
  }
}
