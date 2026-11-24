import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check, FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/api/client";
import {
  billingKey,
  cancelSubscription,
  invoicePdfUrl,
  invoicesQuery,
  paymentsQuery,
  planPrice,
  plansQuery,
  resumeSubscription,
  subscriptionQuery,
  usageQuery,
  type BillingCycle,
  type Invoice,
  type PaymentStatus,
  type Plan,
  type Subscription,
} from "@/lib/api/billing";
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
import { cycleToSearch, gnf, type PlanCode } from "@/components/billing/checkout-shared";
import { PageHeader } from "@/components/PageHeader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ListPager } from "@/components/ListPager";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/billing/")({
  head: () => ({
    meta: [
      { title: "Abonnement — Konkouré RH" },
      {
        name: "description",
        content:
          "Gérez l'abonnement de votre organisation Konkouré : offre, cycle de facturation et paiements Mobile Money.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: BillingPage,
});

const PAYMENT_STATUS_VARIANT: Record<
  PaymentStatus,
  "default" | "secondary" | "destructive" | "success" | "outline"
> = {
  pending: "secondary",
  processing: "secondary",
  succeeded: "success",
  failed: "destructive",
  expired: "outline",
  refunded: "outline",
};

/** Subscription, usage, plans, payments and invoices of the organization (owner). */
function BillingPage() {
  const { t } = useTranslation();
  const { org } = useOrg();
  const organizationId = org?.id ?? "";
  const { subscription: session } = useSubscription();
  const subscription = useQuery({ ...subscriptionQuery(organizationId), enabled: !!org });
  const plans = useQuery({ ...plansQuery(organizationId), enabled: !!org });

  return (
    <div className="space-y-6">
      <PageHeader title={t("billing.pageTitle")} description={t("billing.pageDescription")} />

      {subscription.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : subscription.isError ? (
        <p className="text-sm text-destructive">{apiErrorMessage(subscription.error)}</p>
      ) : (
        <SubscriptionCard subscription={subscription.data} plans={plans.data ?? []} />
      )}

      <UsageCard />

      <ModulesCard
        planCode={session.planCode}
        modules={session.modules}
        trialActive={session.trialActive}
      />

      <PlansGrid plans={plans.data} currentPlanId={subscription.data?.plan?.id ?? null} />
      <p className="text-xs text-muted-foreground">{t("billing.enterpriseHint")}</p>

      <div className="grid gap-6 lg:grid-cols-2">
        <PaymentsCard plans={plans.data ?? []} />
        <InvoicesCard />
      </div>
    </div>
  );
}

function SubscriptionCard({ subscription, plans }: { subscription: Subscription; plans: Plan[] }) {
  const { t } = useTranslation();
  const { org } = useOrg();
  const organizationId = org?.id ?? "";
  const queryClient = useQueryClient();
  const { refetch: reloadSession } = useSubscription();
  const [confirm, setConfirm] = useState<"cancel" | "resume" | null>(null);
  const plan = plans.find((p) => p.id === subscription.plan?.id);
  const paid = (plan?.priceMonthlyGnf ?? 0) > 0;
  const periodRuns = new Date(subscription.currentPeriodEnd).getTime() > Date.now();
  const canceledUntilTerm = subscription.cancelAtPeriodEnd && periodRuns;
  const canCancel =
    paid && ["active", "past_due"].includes(subscription.status) && !subscription.cancelAtPeriodEnd;
  const canResume = subscription.status === "canceled" && canceledUntilTerm;
  const trialActive =
    subscription.status === "trialing" &&
    !!subscription.trialEndsAt &&
    new Date(subscription.trialEndsAt).getTime() > Date.now();

  const change = useMutation({
    mutationFn: (action: "cancel" | "resume") =>
      action === "cancel" ? cancelSubscription() : resumeSubscription(),
    onSuccess: (_, action) => {
      setConfirm(null);
      toast.success(action === "cancel" ? t("billing.cancelSuccess") : t("billing.resumeSuccess"));
      void reloadSession?.();
      return queryClient.invalidateQueries({ queryKey: billingKey(organizationId) });
    },
    onError: (e) => {
      setConfirm(null);
      toast.error(apiErrorMessage(e));
    },
  });

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0 space-y-1">
          <p className="text-sm text-muted-foreground">{t("billing.currentPlan")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xl font-bold">{subscription.plan?.name ?? "—"}</p>
            <Badge
              data-testid="subscription-status"
              variant={
                canceledUntilTerm
                  ? "outline"
                  : ["active", "trialing"].includes(subscription.status)
                    ? "success"
                    : "secondary"
              }
            >
              {canceledUntilTerm
                ? t("billing.canceledUntil", { date: formatDate(subscription.currentPeriodEnd) })
                : t(`billing.statuses.${subscription.status}`)}
            </Badge>
          </div>
          {plan && (
            <p className="text-sm text-muted-foreground">
              {t("billing.upToEmployees", { count: plan.maxEmployees })}
              {paid && !subscription.cancelAtPeriodEnd
                ? t("billing.dueOn", { date: formatDate(subscription.currentPeriodEnd) })
                : ""}
              {paid ? ` · ${t(`billing.cycles.${subscription.cycle}`)}` : ""}
            </p>
          )}
          {trialActive && subscription.trialEndsAt && (
            <p className="text-sm text-muted-foreground">
              {t("billing.trialActive", {
                count: daysLeft(subscription.trialEndsAt),
                date: formatDate(subscription.trialEndsAt),
              })}
            </p>
          )}
          {canceledUntilTerm && (
            <p className="text-sm text-muted-foreground">{t("billing.graceCanceledNote")}</p>
          )}
          {subscription.scheduledPlan && (
            <p className="text-sm text-muted-foreground">
              {t("billing.scheduledChange", {
                plan: subscription.scheduledPlan.name,
                date: formatDate(subscription.currentPeriodEnd),
              })}
            </p>
          )}
        </div>
        {canCancel && (
          <Button variant="outline" className="shrink-0" onClick={() => setConfirm("cancel")}>
            {t("billing.cancelSubscription")}
          </Button>
        )}
        {canResume && (
          <Button className="shrink-0" onClick={() => setConfirm("resume")}>
            {t("billing.resumeSubscription")}
          </Button>
        )}
      </CardContent>
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(v) => !v && setConfirm(null)}
        title={confirm === "resume" ? t("billing.resumeConfirm") : t("billing.cancelConfirm")}
        description={
          confirm === "resume"
            ? t("billing.resumeConfirmDesc")
            : t("billing.cancelConfirmDesc", { date: formatDate(subscription.currentPeriodEnd) })
        }
        actionLabel={
          confirm === "resume" ? t("billing.resumeSubscription") : t("billing.cancelSubscription")
        }
        actionVariant={confirm === "resume" ? "default" : "destructive"}
        loading={change.isPending}
        onConfirm={() => confirm && change.mutate(confirm)}
      />
    </Card>
  );
}

function UsageCard() {
  const { t } = useTranslation();
  const { org } = useOrg();
  const usage = useQuery({ ...usageQuery(org?.id ?? ""), enabled: !!org });
  if (usage.isPending) return <Skeleton className="h-28 w-full" />;
  if (usage.isError) return null;
  const meter = (label: string, used: number, limit: number | null) => {
    const ratio = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
    return (
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span>{label}</span>
          <span className="tabular-nums text-muted-foreground">
            {limit === null
              ? t("billing.usageUnlimited", { used })
              : t("billing.usageOf", { used, limit })}
          </span>
        </div>
        {limit !== null && <Progress value={ratio} aria-label={label} />}
      </div>
    );
  };
  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-6">
        <h2 className="font-semibold">{t("billing.usageTitle", { period: usage.data.period })}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {meter(
            t("billing.usageEmployees"),
            usage.data.employees.used,
            usage.data.employees.limit,
          )}
          {meter(
            t("billing.usageAiCredits"),
            usage.data.aiCredits.used,
            usage.data.aiCredits.limit,
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PlansGrid({ plans, currentPlanId }: { plans?: Plan[]; currentPlanId: string | null }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  if (!plans) return <Skeleton className="h-64 w-full" />;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={cycle === "monthly" ? "default" : "outline"}
          onClick={() => setCycle("monthly")}
        >
          {t("billing.cycleMonthly")}
        </Button>
        <Button
          size="sm"
          variant={cycle === "yearly" ? "default" : "outline"}
          onClick={() => setCycle("yearly")}
        >
          {t("billing.cycleYearly")}
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((p) => {
          const current = p.id === currentPlanId;
          const free = p.priceMonthlyGnf <= 0;
          return (
            <Card
              key={p.id}
              data-testid="plan-card"
              className={current ? "border-primary" : undefined}
            >
              <CardContent className="flex h-full flex-col gap-3 p-6">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold">{p.name}</h3>
                  {current && <Badge variant="success">{t("billing.current")}</Badge>}
                </div>
                <p className="text-2xl font-black tabular-nums">
                  {gnf(planPrice(p, cycle))}{" "}
                  <span className="text-sm font-medium text-muted-foreground">GNF</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {cycle === "yearly" ? t("billing.perYear") : t("billing.perMonth")}
                </p>
                <ul className="space-y-1.5 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    {t("billing.upToEmployeesFeature", { count: p.maxEmployees })}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    {t("billing.aiCreditsFeature", { count: p.aiCreditsPerMonth })}
                  </li>
                </ul>
                <div className="mt-auto pt-3">
                  <Button
                    className="w-full"
                    disabled={free || current}
                    variant={current ? "outline" : "default"}
                    onClick={() =>
                      navigate({
                        to: "/app/billing/checkout",
                        search: { plan: p.code as PlanCode, cycle: cycleToSearch(cycle) },
                      })
                    }
                  >
                    {free
                      ? t("billing.freePlan")
                      : current
                        ? t("billing.currentPlanBtn")
                        : t("billing.choosePlan")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function PaymentsCard({ plans }: { plans: Plan[] }) {
  const { t } = useTranslation();
  const { org } = useOrg();
  const [page, setPage] = useState(1);
  const payments = useQuery({ ...paymentsQuery(org?.id ?? "", page), enabled: !!org });
  const rows = payments.data?.data ?? [];
  return (
    <Card>
      <CardContent className="space-y-3 p-4 sm:p-6">
        <h2 className="font-semibold">{t("billing.paymentsTitle")}</h2>
        {payments.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("billing.noPayments")}</p>
        ) : (
          <ul className="divide-y" data-testid="payments-list">
            {rows.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {plans.find((pl) => pl.id === p.planId)?.name ?? "—"}
                    {p.method ? ` · ${t(`billing.methods.${p.method}`)}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDate(p.createdAt)}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="tabular-nums">{gnf(p.expectedAmount)} GNF</span>
                  <Badge variant={PAYMENT_STATUS_VARIANT[p.status]}>
                    {t(`billing.paymentStatuses.${p.status}`)}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
        <ListPager page={page} lastPage={payments.data?.meta.lastPage ?? 1} onChange={setPage} />
      </CardContent>
    </Card>
  );
}

function InvoicesCard() {
  const { t } = useTranslation();
  const { org } = useOrg();
  const [page, setPage] = useState(1);
  const invoices = useQuery({ ...invoicesQuery(org?.id ?? "", page), enabled: !!org });
  const pdf = useMutation({
    mutationFn: (invoice: Invoice) => invoicePdfUrl(invoice.id),
    onSuccess: ({ url }) => {
      window.open(url, "_blank", "noopener,noreferrer");
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const rows = invoices.data?.data ?? [];
  return (
    <Card>
      <CardContent className="space-y-3 p-4 sm:p-6">
        <h2 className="font-semibold">{t("billing.invoicesTitle")}</h2>
        {invoices.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("billing.noInvoices")}</p>
        ) : (
          <ul className="divide-y">
            {rows.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{inv.number}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("billing.invoicePeriod", {
                      start: formatDate(inv.periodStart),
                      end: formatDate(inv.periodEnd),
                    })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="tabular-nums">{gnf(inv.amount)} GNF</span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!inv.hasPdf || pdf.isPending}
                    title={
                      inv.hasPdf ? t("billing.downloadInvoice") : t("billing.invoicePdfPending")
                    }
                    aria-label={t("billing.downloadInvoiceOf", { number: inv.number })}
                    onClick={() => pdf.mutate(inv)}
                  >
                    {pdf.isPending && pdf.variables?.id === inv.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <ListPager page={page} lastPage={invoices.data?.meta.lastPage ?? 1} onChange={setPage} />
      </CardContent>
    </Card>
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
