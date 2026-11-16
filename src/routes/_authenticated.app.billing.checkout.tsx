import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { pendingQuery } from "@/lib/api/pending";
import { useOrg } from "@/hooks/useOrg";
import {
  createDirectPayment,
  createDjomyPayment,
  refreshPaymentStatus,
} from "@/lib/api/legacy-functions";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Loader2,
  Smartphone,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

type Cycle = "mensuel" | "annuel";
type PlanCode = "essentiel" | "professionnel" | "entreprise";
type Method = "orange_money" | "mtn_momo" | "card";

interface PlanRow {
  id: string;
  code: string;
  nom: string;
  prix_gnf: number;
  max_employes: number;
  credits_ia_mois: number;
  sort_order: number;
}

const PLAN_CODES: PlanCode[] = ["essentiel", "professionnel", "entreprise"];

function useMethods(t: (k: string) => string): { value: Method; label: string; hint: string }[] {
  return [
    { value: "orange_money", label: t("checkout.methodOrangeMoney"), hint: t("checkout.methodMobileHint") },
    { value: "mtn_momo", label: t("checkout.methodMtnMomo"), hint: t("checkout.methodMobileHint") },
    { value: "card", label: t("checkout.methodCard"), hint: t("checkout.methodCardHint") },
  ];
}

const gnf = (v: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 })
    .format(Math.round(v))
    .replace(/\u202f|\u00a0/g, " ");

const digits = (v: string) => v.replace(/\D/g, "");
const isValidGnPhone = (v: string) => {
  const d = digits(v).replace(/^224/, "");
  return d.length === 9 && d.startsWith("6");
};

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
    plan: PLAN_CODES.includes(search.plan as PlanCode) ? (search.plan as PlanCode) : "essentiel",
    cycle: search.cycle === "annuel" ? ("annuel" as Cycle) : ("mensuel" as Cycle),
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { t } = useTranslation();
  const METHODS = useMethods(t);
  const search = useSearch({ from: "/_authenticated/app/billing/checkout" });
  const navigate = useNavigate();
  const { org } = useOrg();

  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [cycle, setCycle] = useState<Cycle>(search.cycle);
  const [planCode, setPlanCode] = useState<PlanCode>(search.plan);
  const [method, setMethod] = useState<Method | null>(null);
  const [payerNumber, setPayerNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("pending");
  const [elapsed, setElapsed] = useState(0);

  const startDirect = createDirectPayment;
  const startGateway = createDjomyPayment;
  const refresh = refreshPaymentStatus;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void pendingQuery("GET /org/billing/plans");
  }, []);

  const plan = plans.find((p) => p.code === planCode) ?? null;
  const amount = plan ? (cycle === "annuel" ? plan.prix_gnf * 10 : plan.prix_gnf) : 0;

  // Suivi du paiement Mobile Money : le statut est toujours revalidé côté serveur.
  useEffect(() => {
    if (!reference) return;
    let cancelled = false;

    const poll = async (n: number) => {
      try {
        const res: any = await refresh({ data: { merchantReference: reference } });
        if (cancelled) return;
        const next = res?.status ?? "pending";
        setStatus(next);
        setElapsed(n * 3);
        if (next === "pending" && n < 60) timer.current = setTimeout(() => void poll(n + 1), 3000);
      } catch {
        if (!cancelled && n < 60) timer.current = setTimeout(() => void poll(n + 1), 3000);
      }
    };

    timer.current = setTimeout(() => void poll(1), 3000);
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [reference, refresh]);

  const onPay = async () => {
    if (!org || !plan || !method) return;
    if (method !== "card" && !isValidGnPhone(payerNumber)) return;
    setSubmitting(true);
    try {
      if (method === "card") {
        const { redirectUrl } = await startGateway({
          data: {
            organizationId: org.id,
            planCode,
            cycle,
            paymentMethod: "card",
            payerNumber: digits(payerNumber).replace(/^224/, "") || "600000000",
          },
        });
        window.location.href = redirectUrl;
        return;
      }
      const res: any = await startDirect({
        data: {
          organizationId: org.id,
          planCode,
          cycle,
          paymentMethod: method,
          payerNumber: digits(payerNumber).replace(/^224/, ""),
        },
      });
      setStatus("pending");
      setElapsed(0);
      setReference(res.merchantReference);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("checkout.startError"));
    } finally {
      setSubmitting(false);
    }
  };

  const checkNow = async () => {
    if (!reference) return;
    try {
      const res: any = await refresh({ data: { merchantReference: reference } });
      setStatus(res?.status ?? "pending");
    } catch {
      toast.error(t("checkout.checkError"));
    }
  };

  const reset = () => {
    if (timer.current) clearTimeout(timer.current);
    setReference(null);
    setStatus("pending");
    setElapsed(0);
  };

  // --- Écrans de suivi / résultat -----------------------------------------
  if (reference) {
    const success = status === "success";
    const failed = ["failed", "cancelled", "mismatch"].includes(status);

    return (
      <div className="mx-auto max-w-lg py-10">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            {success ? (
              <CheckCircle2 className="h-10 w-10 text-success" />
            ) : failed ? (
              <XCircle className="h-10 w-10 text-destructive" />
            ) : (
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            )}
            <h1 className="text-xl font-bold">
              {success
                ? t("checkout.statusConfirmed")
                : failed
                  ? t("checkout.statusFailed")
                  : t("checkout.statusValidateOnPhone")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {success
                ? t("checkout.resultConfirmed", { plan: plan?.nom ?? "" })
                : failed
                  ? t("checkout.resultFailed")
                  : t("checkout.resultPending", {
                      amount: gnf(amount),
                      phone: digits(payerNumber).slice(-9),
                    })}
            </p>
            {!success && !failed && (
              <p className="text-xs text-muted-foreground">{t("checkout.waitingSince", { count: elapsed })}</p>
            )}
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
              {!success && !failed && (
                <>
                  <Button variant="outline" onClick={() => void checkNow()}>
                    {t("checkout.iPaidCheck")}
                  </Button>
                  <Button variant="ghost" onClick={reset}>
                    {t("checkout.cancelAction")}
                  </Button>
                </>
              )}
              {failed && (
                <Button variant="outline" onClick={reset}>
                  {t("checkout.retry")}
                </Button>
              )}
              {success && (
                <Button asChild>
                  <Link to="/app/billing">{t("checkout.returnToBilling")}</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Formulaire de paiement ---------------------------------------------
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={t("checkout.pageTitle")}
        description={t("checkout.pageDescription")}
      />

      <Card>
        <CardContent className="space-y-6 p-6">
          <div className="grid gap-2 sm:grid-cols-3">
            {plans
              .filter((p) => p.prix_gnf > 0)
              .map((p) => {
                const active = p.code === planCode;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlanCode(p.code as PlanCode)}
                    className={`rounded-lg border p-4 text-left transition-colors ${
                      active
                        ? "border-primary bg-accent/40"
                        : "border-border bg-card hover:border-primary"
                    }`}
                  >
                    <span className="block text-sm font-semibold text-foreground">{p.nom}</span>
                    <span className="block text-xs text-muted-foreground">
                      {t("checkout.upToEmployees", { count: p.max_employes })}
                    </span>
                  </button>
                );
              })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={cycle === "mensuel" ? "default" : "outline"}
              onClick={() => setCycle("mensuel")}
            >
              {t("checkout.cycleMonthly")}
            </Button>
            <Button
              size="sm"
              variant={cycle === "annuel" ? "default" : "outline"}
              onClick={() => setCycle("annuel")}
            >
              {t("checkout.cycleYearly")}
            </Button>
            {cycle === "annuel" && <Badge variant="success">{t("checkout.twoMonthsFree")}</Badge>}
          </div>

          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <p className="text-sm text-muted-foreground">{t("checkout.amountToPay")}</p>
            <p className="text-2xl font-black tabular-nums">
              {gnf(amount)} <span className="text-sm font-medium text-muted-foreground">GNF</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {t("checkout.offerBilling", {
                plan: plan?.nom ?? "—",
                cycle: cycle === "annuel" ? t("checkout.billingYearly") : t("checkout.billingMonthly"),
              })}
            </p>
          </div>

          {!method ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold">{t("checkout.chooseMethod")}</p>
              <div className="grid gap-2">
                {METHODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMethod(m.value)}
                    className="flex items-center justify-between rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-accent"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-foreground">{m.label}</span>
                      <span className="block text-xs text-muted-foreground">{m.hint}</span>
                    </span>
                    {m.value === "card" ? (
                      <CreditCard className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <Smartphone className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-primary bg-accent/40 px-4 py-3">
                <span className="text-sm font-semibold">
                  {METHODS.find((m) => m.value === method)?.label}
                </span>
                <Button variant="ghost" size="sm" onClick={() => setMethod(null)}>
                  <ArrowLeft className="mr-1 h-4 w-4" /> {t("checkout.change")}
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payer">
                  {method === "card" ? t("checkout.phoneLabelCard") : t("checkout.phoneLabelMobile")}
                </Label>
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

              <p className="text-xs text-muted-foreground">
                {method === "card" ? t("checkout.cardHint") : t("checkout.mobileHint")}
              </p>

              <Button
                className="w-full"
                disabled={submitting || !plan || !isValidGnPhone(payerNumber)}
                onClick={() => void onPay()}
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {method === "card" ? t("checkout.continueCard") : t("checkout.payAmount", { amount: gnf(amount) })}
              </Button>
            </div>
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
