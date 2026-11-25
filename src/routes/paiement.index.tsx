import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import i18n from "@/lib/i18n";
import { ApiError, apiErrorMessage, newIdempotencyKey } from "@/lib/api/client";
import { planPrice, toApiPhone } from "@/lib/api/billing";
import {
  publicPlansQuery,
  startPresignupCheckout,
  type PendingClaim,
} from "@/lib/api/billing-public";
import { savePendingClaim } from "@/lib/pending-claim";
import { PaymentStatusTracker } from "@/components/billing/PaymentStatusTracker";
import { Logo } from "@/components/brand/Logo";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AmountSummary,
  CyclePicker,
  MethodPicker,
  PLAN_CODES,
  PlanPicker,
  SelectedMethodBar,
  cycleFromSearch,
  digits,
  gnf,
  isValidGnPhone,
  type Cycle,
  type Method,
  type PlanCode,
  type SearchCycle,
} from "@/components/billing/checkout-shared";

export const Route = createFileRoute("/paiement/")({
  head: () => ({
    meta: [
      { title: i18n.t("paiement.metaCheckoutTitle") },
      { name: "description", content: i18n.t("paiement.metaCheckoutDesc") },
      { property: "og:title", content: i18n.t("paiement.metaCheckoutTitle") },
      { property: "og:description", content: i18n.t("paiement.metaCheckoutOgDesc") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    plan: PLAN_CODES.includes(search.plan as PlanCode) ? (search.plan as PlanCode) : "starter",
    cycle: (search.cycle === "annuel" ? "annuel" : "mensuel") as SearchCycle,
  }),
  component: PublicCheckoutPage,
});

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function checkoutError(error: unknown, t: TFunction) {
  if (error instanceof ApiError && error.status === 503) return t("paiement.providerUnavailable");
  return apiErrorMessage(error);
}

function PublicCheckoutPage() {
  const { t } = useTranslation();
  const search = useSearch({ from: "/paiement/" });
  const plans = useQuery(publicPlansQuery());

  const [cycle, setCycle] = useState<Cycle>(cycleFromSearch(search.cycle));
  const [planCode, setPlanCode] = useState<PlanCode>(search.plan);
  const [method, setMethod] = useState<Method | null>(null);
  const [email, setEmail] = useState("");
  const [payerNumber, setPayerNumber] = useState("");
  const [started, setStarted] = useState<{ claim: PendingClaim; instructions: string | null }>();
  // One key per attempt: a double click replays the same checkout.
  const [attemptKey, setAttemptKey] = useState(newIdempotencyKey);

  const plan = plans.data?.find((p) => p.code === planCode) ?? null;
  const amount = plan ? planPrice(plan, cycle) : 0;
  const emailOk = EMAIL.test(email.trim());
  const isMobile = method === "orange_money" || method === "mtn_momo";

  const checkout = useMutation({
    mutationFn: () =>
      startPresignupCheckout(
        {
          planId: plan!.id,
          cycle,
          method: method!,
          email: email.trim(),
          ...(isMobile ? { payerPhone: toApiPhone(payerNumber) } : {}),
        },
        attemptKey,
      ),
    onSuccess: (result) => {
      // The claim code is returned only once: keep it before leaving the page.
      const claim = { ref: result.merchantReference, token: result.claimToken };
      savePendingClaim(claim);
      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
        return;
      }
      setStarted({ claim, instructions: result.instructions });
    },
    onError: (e) => {
      setAttemptKey(newIdempotencyKey());
      toast.error(checkoutError(e, t));
    },
  });

  if (started) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
        <Logo />
        <div className="space-y-1">
          <h1 className="text-2xl font-black">{t("paiement.validateOnPhone")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("paiement.requestSentTo", {
              amount: gnf(amount),
              phone: digits(payerNumber).slice(-9),
            })}{" "}
            {started.instructions ?? t("paiement.dialConfirmation")}
          </p>
        </div>

        <PaymentStatusTracker
          claim={started.claim}
          extraActions={
            <Button asChild variant="ghost" size="sm">
              <Link
                to="/paiement/suivi"
                search={{ ref: started.claim.ref, claim: started.claim.token }}
              >
                {t("paiement.trackThisPayment")}
              </Link>
            </Button>
          }
        />

        <p className="text-center text-xs text-muted-foreground">
          {t("paiement.keepTrackingCode")}
        </p>
      </div>
    );
  }

  const canPay =
    !!plan &&
    !!method &&
    emailOk &&
    (!isMobile || isValidGnPhone(payerNumber)) &&
    !checkout.isPending;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <Logo />
      <div className="space-y-1">
        <h1 className="text-2xl font-black">{t("paiement.payTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("paiement.paySubtitle")}</p>
      </div>

      <Card>
        <CardContent className="space-y-6 p-6">
          {plans.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : plans.isError ? (
            <p className="text-sm text-destructive">{apiErrorMessage(plans.error)}</p>
          ) : (
            <PlanPicker plans={plans.data} planCode={planCode} onSelect={setPlanCode} />
          )}
          <CyclePicker cycle={cycle} onSelect={setCycle} />
          <AmountSummary amount={amount} planName={plan?.name ?? null} cycle={cycle} />

          <div className="space-y-2">
            <Label htmlFor="email">{t("paiement.emailLabel")}</Label>
            <Input
              id="email"
              type="email"
              maxLength={254}
              autoComplete="email"
              placeholder={t("paiement.emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {email && !emailOk ? (
              <p className="text-xs text-destructive">{t("paiement.emailInvalid")}</p>
            ) : (
              <p className="text-xs text-muted-foreground">{t("paiement.emailHint")}</p>
            )}
          </div>

          {!method ? (
            <MethodPicker onSelect={setMethod} />
          ) : (
            <div className="space-y-4">
              <SelectedMethodBar method={method} onChange={() => setMethod(null)} />

              {isMobile && (
                <div className="space-y-2">
                  <Label htmlFor="payer">{t("paiement.payerPhoneMomoLabel")}</Label>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                      +224
                    </span>
                    <Input
                      id="payer"
                      inputMode="tel"
                      maxLength={14}
                      placeholder={t("paiement.phonePlaceholder")}
                      value={payerNumber}
                      onChange={(e) => setPayerNumber(e.target.value)}
                    />
                  </div>
                  {payerNumber && !isValidGnPhone(payerNumber) && (
                    <p className="text-xs text-destructive">{t("paiement.phoneInvalid")}</p>
                  )}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                {method === "card" ? t("paiement.cardHint") : t("paiement.momoHint")}
              </p>

              <Button className="w-full" disabled={!canPay} onClick={() => checkout.mutate()}>
                {checkout.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {method === "card"
                  ? t("paiement.continueToCard")
                  : t("paiement.payAmount", { amount: gnf(amount) })}
              </Button>
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground">
            {t("paiement.alreadyAccount")}{" "}
            <Link
              to="/login"
              search={{}}
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              {t("paiement.signIn")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
