import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { CalendarClock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ApiError, apiErrorMessage, newIdempotencyKey } from "@/lib/api/client";
import {
  billingKey,
  isScheduled,
  planPrice,
  plansQuery,
  startCheckout,
  subscriptionQuery,
  toApiPhone,
  type CheckoutScheduled,
  type CheckoutStarted,
} from "@/lib/api/billing";
import { formatDate } from "@/lib/format";
import { useOrg } from "@/hooks/useOrg";
import { useSubscription } from "@/hooks/useSubscription";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { PaymentProgress } from "@/components/billing/PaymentProgress";
import {
  AmountSummary,
  cycleFromSearch,
  CyclePicker,
  gnf,
  isValidGnPhone,
  MethodPicker,
  PLAN_CODES,
  PlanPicker,
  SelectedMethodBar,
  type Cycle,
  type Method,
  type PlanCode,
  type SearchCycle,
} from "@/components/billing/checkout-shared";

export const Route = createFileRoute("/_authenticated/app/billing/checkout")({
  head: () => ({
    meta: [
      { title: "Paiement de l'abonnement — Konkouré RH" },
      {
        name: "description",
        content:
          "Réglez votre abonnement Konkouré RH en Orange Money, MTN MoMo ou carte bancaire, en francs guinéens.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    plan: PLAN_CODES.includes(search.plan as PlanCode) ? (search.plan as PlanCode) : "starter",
    cycle: (search.cycle === "annuel" ? "annuel" : "mensuel") as SearchCycle,
  }),
  component: CheckoutPage,
});

/** A plan already being paid for: moving to a cheaper one is scheduled at the term. */
const PAID_STATUSES = ["active", "past_due"];

function checkoutError(error: unknown, t: TFunction) {
  if (error instanceof ApiError) {
    if (error.code === "E_QUOTA_EXCEEDED") {
      const count = Number(error.details[0]?.rule);
      if (Number.isFinite(count)) return t("checkout.quotaExceeded", { count });
    }
    if (error.status === 503) return t("checkout.providerUnavailable");
  }
  return apiErrorMessage(error);
}

function CheckoutPage() {
  const { t } = useTranslation();
  const search = useSearch({ from: "/_authenticated/app/billing/checkout" });
  const navigate = useNavigate();
  const { org } = useOrg();
  const organizationId = org?.id ?? "";
  const queryClient = useQueryClient();
  const { refetch: reloadSession } = useSubscription();
  const plans = useQuery({ ...plansQuery(organizationId), enabled: !!org });
  const subscription = useQuery({ ...subscriptionQuery(organizationId), enabled: !!org });

  const [cycle, setCycle] = useState<Cycle>(cycleFromSearch(search.cycle));
  const [planCode, setPlanCode] = useState<PlanCode>(search.plan);
  const [method, setMethod] = useState<Method | null>(null);
  const [payerNumber, setPayerNumber] = useState("");
  const [started, setStarted] = useState<CheckoutStarted | null>(null);
  const [scheduled, setScheduled] = useState<CheckoutScheduled | null>(null);
  // One key per attempt: a double click replays the same checkout.
  const [attemptKey, setAttemptKey] = useState(newIdempotencyKey);

  const plan = plans.data?.find((p) => p.code === planCode) ?? null;
  const amount = plan ? planPrice(plan, cycle) : 0;
  const current = plans.data?.find((p) => p.id === subscription.data?.plan?.id) ?? null;
  const isDowngrade =
    !!plan &&
    !!current &&
    current.priceMonthlyGnf > 0 &&
    PAID_STATUSES.includes(subscription.data?.status ?? "") &&
    plan.priceMonthlyGnf < current.priceMonthlyGnf;
  const isMobile = method === "orange_money" || method === "mtn_momo";

  const checkout = useMutation({
    mutationFn: () =>
      startCheckout(
        {
          planId: plan!.id,
          cycle,
          // A downgrade needs no payment; the API still asks for a method.
          method: isDowngrade ? "card" : method!,
          ...(isMobile && !isDowngrade ? { payerPhone: toApiPhone(payerNumber) } : {}),
        },
        attemptKey,
      ),
    onSuccess: async (result) => {
      if (isScheduled(result)) {
        setScheduled(result);
        await queryClient.invalidateQueries({ queryKey: billingKey(organizationId) });
        void reloadSession?.();
        return;
      }
      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
        return;
      }
      setStarted(result);
    },
    onError: (e) => {
      setAttemptKey(newIdempotencyKey());
      toast.error(checkoutError(e, t));
    },
  });

  const retry = () => {
    setStarted(null);
    setAttemptKey(newIdempotencyKey());
  };

  if (started) {
    return (
      <div className="mx-auto max-w-lg py-10">
        <PaymentProgress
          paymentId={started.paymentId}
          instructions={started.instructions}
          onRetry={retry}
        />
      </div>
    );
  }

  if (scheduled) {
    const target = plans.data?.find((p) => p.id === scheduled.planId);
    return (
      <div className="mx-auto max-w-lg py-10">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center" role="status">
            <CalendarClock className="h-10 w-10 text-primary" />
            <h1 className="text-xl font-bold">{t("checkout.scheduledTitle")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("checkout.scheduledDesc", {
                plan: target?.name ?? "",
                date: formatDate(scheduled.effectiveAt),
              })}
            </p>
            <Button asChild>
              <Link to="/app/billing">{t("checkout.returnToBilling")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canPay =
    !!plan && !!method && (!isMobile || isValidGnPhone(payerNumber)) && !checkout.isPending;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={t("checkout.pageTitle")} description={t("checkout.pageDescription")} />

      <Card>
        <CardContent className="space-y-6 p-4 sm:p-6">
          {plans.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : plans.isError ? (
            <p className="text-sm text-destructive">{apiErrorMessage(plans.error)}</p>
          ) : (
            <PlanPicker plans={plans.data} planCode={planCode} onSelect={setPlanCode} />
          )}

          <CyclePicker cycle={cycle} onSelect={setCycle} />

          {isDowngrade ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
                <p className="font-medium">{t("checkout.downgradeTitle", { plan: plan?.name })}</p>
                <p className="mt-1 text-muted-foreground">
                  {t("checkout.downgradeDesc", {
                    date: subscription.data ? formatDate(subscription.data.currentPeriodEnd) : "",
                  })}
                </p>
              </div>
              <Button
                className="w-full"
                disabled={checkout.isPending}
                onClick={() => checkout.mutate()}
              >
                {checkout.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("checkout.scheduleDowngrade")}
              </Button>
            </div>
          ) : (
            <>
              <AmountSummary amount={amount} planName={plan?.name ?? null} cycle={cycle} />
              {current && current.id !== plan?.id && current.priceMonthlyGnf > 0 && (
                <p className="text-xs text-muted-foreground">{t("checkout.prorataHint")}</p>
              )}

              {!method ? (
                <MethodPicker onSelect={setMethod} />
              ) : (
                <div className="space-y-4">
                  <SelectedMethodBar method={method} onChange={() => setMethod(null)} />
                  {isMobile && (
                    <div className="space-y-2">
                      <Label htmlFor="payer">{t("checkout.phoneLabelMobile")}</Label>
                      <div className="flex items-center gap-2">
                        <span className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                          +224
                        </span>
                        <Input
                          id="payer"
                          inputMode="tel"
                          maxLength={14}
                          placeholder={t("checkout.phonePlaceholder")}
                          value={payerNumber}
                          onChange={(e) => setPayerNumber(e.target.value)}
                        />
                      </div>
                      {payerNumber && !isValidGnPhone(payerNumber) && (
                        <p className="text-xs text-destructive">{t("checkout.invalidPhone")}</p>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {method === "card" ? t("checkout.cardHint") : t("checkout.mobileHint")}
                  </p>
                  <Button className="w-full" disabled={!canPay} onClick={() => checkout.mutate()}>
                    {checkout.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {method === "card"
                      ? t("checkout.continueCard")
                      : t("checkout.payAmount", { amount: gnf(amount) })}
                  </Button>
                </div>
              )}
            </>
          )}

          <Button
            variant="ghost"
            className="w-full"
            onClick={() => navigate({ to: "/app/billing" })}
          >
            {t("checkout.backToBilling")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
