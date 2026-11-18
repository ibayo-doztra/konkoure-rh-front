import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { pendingQuery } from "@/lib/api/pending";
import { useTranslation } from "react-i18next";
import { useOrg } from "@/hooks/useOrg";
import { useSubscription } from "@/hooks/useSubscription";
import {
  FREE_AFTER_TRIAL_MODULES,
  MODULE_LABELS,
  PLAN_LABELS,
  PLAN_MODULES,
  PLAN_ORDER,
  type ModuleKey,
} from "@/lib/entitlements";
import { cancelSubscription } from "@/lib/api/legacy-functions";
import { claimPrepaidPayment } from "@/lib/api/legacy-functions";
import { clearPendingClaim, peekPendingClaim } from "@/lib/pending-claim";
import { PaymentStatusTracker } from "@/components/billing/PaymentStatusTracker";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/useConfirm";

export const Route = createFileRoute("/_authenticated/app/billing/")({
  head: () => ({
    meta: [
      { title: "Abonnement — Konkouré RH" },
      { name: "description", content: "Gérez l'abonnement de votre organisation Konkouré : offre, cycle de facturation et paiements Mobile Money." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: BillingPage,
});

type Cycle = "mensuel" | "annuel";

interface PlanRow {
  id: string;
  code: string;
  nom: string;
  prix_gnf: number;
  max_employes: number;
  credits_ia_mois: number;
  sort_order: number;
}

const gnf = (v: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(v)).replace(/\u202f|\u00a0/g, " ");

function statutLabel(t: (k: string) => string, statut: string): string {
  const map: Record<string, string> = {
    trialing: t("billing.statusTrialing"),
    active: t("billing.statusActive"),
    past_due: t("billing.statusPastDue"),
    suspended: t("billing.statusSuspended"),
    canceled: t("billing.statusCanceled"),
    expired: t("billing.statusExpired"),
  };
  return map[statut] ?? statut;
}

/**
 * Suivi d'un paiement effectué avant la création du compte, tant qu'il n'est
 * pas rattaché à l'organisation courante.
 */
function PendingClaimPanel() {
  const { t } = useTranslation();
  const { org } = useOrg();
  const claimFn = claimPrepaidPayment;
  const [token, setToken] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setToken(peekPendingClaim());
  }, []);

  const onStatus = useCallback((summary: { status: string; claimed: boolean } | null) => {
    setPaid(summary?.status === "success");
    setClaimed(!!summary?.claimed);
  }, []);

  useEffect(() => {
    if (claimed) {
      clearPendingClaim();
      const t = setTimeout(() => setToken(null), 4000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [claimed]);

  if (!token) return null;

  const onClaim = async () => {
    if (!org) return;
    setBusy(true);
    try {
      const res: any = await claimFn({ data: { claimToken: token, organizationId: org.id } });
      if (res?.claimed) {
        clearPendingClaim();
        setToken(null);
        toast.success(t("billing.claimSuccess"));
        window.location.reload();
      } else if (res?.reason === "EMAIL_MISMATCH") {
        toast.error(t("billing.claimEmailMismatch"));
      } else if (res?.reason === "NOT_PAID") {
        toast.warning(t("billing.claimNotPaid"));
      } else {
        clearPendingClaim();
        setToken(null);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("billing.claimError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PaymentStatusTracker
      claimToken={token}
      hideActions
      onStatus={onStatus}
      extraActions={
        paid && !claimed ? (
          <Button size="sm" disabled={busy || !org} onClick={() => void onClaim()}>
            {t("billing.claimRattach")}
          </Button>
        ) : null
      }
    />
  );
}

function BillingPage() {
  const { t } = useTranslation();
  const { confirm, confirmDialog } = useConfirm();
  const { org } = useOrg();
  const navigate = useNavigate();
  const { subscription, loading } = useSubscription();
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [cycle, setCycle] = useState<Cycle>("mensuel");

  const cancelFn = cancelSubscription;

  useEffect(() => {
    void pendingQuery("GET /org/billing/plans");
  }, []);

  const amountFor = (p: PlanRow) => (cycle === "annuel" ? p.prix_gnf * 10 : p.prix_gnf);

  const onCancel = async () => {
    if (!org) return;
    if (!(await confirm({ title: t("billing.cancelConfirm"), description: t("billing.cancelConfirmDesc"), actionLabel: t("common.confirm"), actionVariant: "destructive" }))) return;
    try {
      await cancelFn({ data: { organizationId: org.id } });
      toast.success(t("billing.cancelSuccess"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("billing.cancelError"));
    }
  };

  return (
    <div className="space-y-6">
      {confirmDialog}
      <PageHeader title={t("billing.pageTitle")} description={t("billing.pageDescription")} />

      <PendingClaimPanel />



      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{t("billing.currentPlan")}</p>
            <p className="text-xl font-bold">
              {loading ? "…" : subscription.planName}{" "}
              <Badge
                variant={
                  subscription.graceCanceled
                    ? "outline"
                    : subscription.planEffective
                      ? "success"
                      : "secondary"
                }
              >
                {subscription.graceCanceled
                  ? t("billing.canceledUntil", { date: formatDate(subscription.periodeFin!) })
                  : subscription.statut === "canceled"
                    ? t("billing.statusExpired")
                    : statutLabel(t, subscription.statut)}
              </Badge>
            </p>
            <p className="text-sm text-muted-foreground">
              {t("billing.upToEmployees", { count: subscription.maxEmployes })}
              {subscription.periodeFin
                ? t("billing.dueOn", { date: formatDate(subscription.periodeFin) })
                : ""}
            </p>
            {subscription.trialActive && subscription.trialEndsAt && (
              <p className="text-sm text-muted-foreground">
                {t("billing.trialActive", {
                  count: daysLeft(subscription.trialEndsAt),
                  date: formatDate(subscription.trialEndsAt),
                })}
              </p>
            )}
            {subscription.graceCanceled && (
              <p className="text-sm text-muted-foreground">{t("billing.graceCanceledNote")}</p>
            )}
          </div>
          {subscription.prixGnf > 0 && subscription.statut !== "canceled" && (
            <Button variant="outline" onClick={() => void onCancel()}>
              {t("billing.cancelSubscription")}
            </Button>
          )}
        </CardContent>
      </Card>

      <ModulesCard
        planCode={subscription.planCode}
        modules={subscription.modules}
        trialActive={subscription.trialActive}
      />

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={cycle === "mensuel" ? "default" : "outline"}
          onClick={() => setCycle("mensuel")}
        >
          {t("billing.cycleMonthly")}
        </Button>
        <Button
          size="sm"
          variant={cycle === "annuel" ? "default" : "outline"}
          onClick={() => setCycle("annuel")}
        >
          {t("billing.cycleYearly")}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((p) => {
          const current = p.code === subscription.planCode;
          return (
            <Card key={p.id} className={current ? "border-primary" : undefined}>
              <CardContent className="flex h-full flex-col gap-3 p-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold">{p.nom}</h3>
                  {current && <Badge variant="success">{t("billing.current")}</Badge>}
                </div>
                <p className="text-2xl font-black tabular-nums">
                  {gnf(amountFor(p))} <span className="text-sm font-medium text-muted-foreground">GNF</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {cycle === "annuel" ? t("billing.perYear") : t("billing.perMonth")}
                </p>
                <ul className="space-y-1.5 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" /> {t("billing.upToEmployeesFeature", { count: p.max_employes })}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" /> {t("billing.aiCreditsFeature", { count: p.credits_ia_mois })}
                  </li>
                </ul>
                <div className="mt-auto pt-3">
                  <Button
                    className="w-full"
                    disabled={p.prix_gnf <= 0 || current}
                    variant={current ? "outline" : "default"}
                    onClick={() => navigate({ to: "/app/billing/checkout", search: { plan: p.code as "starter" | "pro" | "enterprise", cycle } })}
                  >
                    {p.prix_gnf <= 0 ? t("billing.freePlan") : current ? t("billing.currentPlanBtn") : t("billing.choosePlan")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">{t("billing.enterpriseHint")}</p>

    </div>
  );
}


/** Jours restants avant une échéance (au moins 1 tant qu'elle n'est pas passée). */
function daysLeft(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(1, Math.ceil(ms / 86_400_000));
}

/** Modules inclus dans l'offre actuelle et modules débloqués par le palier suivant. */
function ModulesCard({
  planCode,
  modules,
  trialActive,
}: {
  planCode: string;
  modules: string[];
  trialActive: boolean;
}) {
  const idx = PLAN_ORDER.indexOf(planCode as (typeof PLAN_ORDER)[number]);
  const nextCode = idx >= 0 ? PLAN_ORDER[idx + 1] : undefined;
  const nextModules = nextCode
    ? (PLAN_MODULES[nextCode] ?? []).filter((m) => !modules.includes(m))
    : [];
  const afterTrial = trialActive
    ? (Object.keys(MODULE_LABELS) as ModuleKey[]).filter(
        (m) => modules.includes(m) && !FREE_AFTER_TRIAL_MODULES.includes(m),
      )
    : [];
  const all = Object.keys(MODULE_LABELS) as ModuleKey[];
  const { t } = useTranslation();

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {trialActive ? t("billing.modulesIncludedTrial") : t("billing.modulesIncludedPlan")}
          </p>
          <div className="flex flex-wrap gap-2">
            {all
              .filter((m) => modules.includes(m))
              .map((m) => (
                <Badge key={m} variant="success">
                  {MODULE_LABELS[m]}
                </Badge>
              ))}
          </div>
        </div>
        {trialActive && afterTrial.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{t("billing.modulesLockAfterTrial")}</p>
            <div className="flex flex-wrap gap-2">
              {afterTrial.map((m) => (
                <Badge key={m} variant="outline" className="text-muted-foreground">
                  {MODULE_LABELS[m]}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {nextCode && nextModules.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {t("billing.modulesUnlockedWith", { plan: PLAN_LABELS[nextCode] ?? nextCode })}
            </p>
            <div className="flex flex-wrap gap-2">
              {nextModules.map((m) => (
                <Badge key={m} variant="outline" className="text-muted-foreground">
                  {MODULE_LABELS[m]}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
