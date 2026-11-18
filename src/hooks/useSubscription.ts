import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { FREE_AFTER_TRIAL_MODULES, type ModuleKey } from "@/lib/entitlements";

export interface SubscriptionState {
  planCode: string;
  planName: string;
  maxEmployes: number;
  creditsIa: number;
  modules: string[];
  statut: "trialing" | "active" | "past_due" | "suspended" | "canceled" | "expired";
  periodeFin: string | null;
  cycle: "mensuel" | "annuel";
  prixGnf: number;
  /** L'offre payée est-elle encore effective (annulation en cours de période incluse) ? */
  planEffective: boolean;
  /** Abonnement annulé mais toujours actif jusqu'à l'échéance. */
  graceCanceled: boolean;
  /** Essai gratuit de 30 jours en cours (offre Gratuit uniquement). */
  trialActive: boolean;
  /** Date de fin de l'essai gratuit, au format ISO. */
  trialEndsAt: string | null;
}

const FALLBACK: SubscriptionState = {
  planCode: "free",
  planName: "Gratuit",
  maxEmployes: 10,
  creditsIa: 20,
  modules: FREE_AFTER_TRIAL_MODULES,
  statut: "trialing",
  periodeFin: null,
  cycle: "mensuel",
  prixGnf: 0,
  planEffective: true,
  graceCanceled: false,
  trialActive: false,
  trialEndsAt: null,
};

/**
 * Abonnement et modules effectifs, calculés par l'API et lus depuis `GET /me`.
 * Le client ne fait que masquer l'interface : l'API refuse les modules hors offre
 * (403 E_MODULE_NOT_INCLUDED).
 */
export function useSubscription() {
  const { me, loading, reload } = useAuth();

  const subscription = useMemo<SubscriptionState>(() => {
    const sub = me?.subscription;
    if (!sub) return { ...FALLBACK, modules: me?.modules ?? FALLBACK.modules };
    return {
      planCode: sub.planCode,
      planName: sub.planName,
      maxEmployes: sub.maxEmployees,
      creditsIa: sub.aiCreditsPerMonth,
      modules: me.modules,
      statut: sub.status,
      periodeFin: sub.currentPeriodEnd,
      cycle: sub.cycle === "yearly" ? "annuel" : "mensuel",
      prixGnf: sub.priceGnf,
      planEffective: sub.planEffective,
      graceCanceled: sub.planCode !== "free" && sub.status === "canceled" && sub.planEffective,
      trialActive: sub.trialEndsAt !== null && new Date(sub.trialEndsAt).getTime() > Date.now(),
      trialEndsAt: sub.trialEndsAt,
    };
  }, [me]);

  const hasModule = (m: ModuleKey | string) => subscription.modules.includes(m);

  return { subscription, hasModule, loading, refetch: reload };
}
