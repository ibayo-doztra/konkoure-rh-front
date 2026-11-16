import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { listPublicPlans, requestPrepaidEmailCode, startPrepaidPayment } from "@/lib/api/legacy-functions";
import { savePendingClaim } from "@/lib/pending-claim";
import { PaymentStatusTracker } from "@/components/billing/PaymentStatusTracker";
import { Logo } from "@/components/brand/Logo";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AmountSummary,
  CyclePicker,
  MethodPicker,
  PLAN_CODES,
  PlanPicker,
  SelectedMethodBar,
  digits,
  gnf,
  isValidGnPhone,
  type Cycle,
  type Method,
  type PlanCode,
  type PlanRow,
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
    plan: PLAN_CODES.includes(search.plan as PlanCode) ? (search.plan as PlanCode) : "essentiel",
    cycle: search.cycle === "annuel" ? ("annuel" as Cycle) : ("mensuel" as Cycle),
  }),
  component: PublicCheckoutPage,
});

function PublicCheckoutPage() {
  const { t } = useTranslation();
  const search = useSearch({ from: "/paiement/" });

  const loadPlans = listPublicPlans;
  const startPayment = startPrepaidPayment;
  const requestCode = requestPrepaidEmailCode;
  const [emailCode, setEmailCode] = useState("");
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  const [sendingCode, setSendingCode] = useState(false);

  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [cycle, setCycle] = useState<Cycle>(search.cycle);
  const [planCode, setPlanCode] = useState<PlanCode>(search.plan);
  const [method, setMethod] = useState<Method | null>(null);
  const [email, setEmail] = useState("");
  const [payerNumber, setPayerNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [claimToken, setClaimToken] = useState<string | null>(null);

  useEffect(() => {
    void loadPlans({}).then((rows: any) => setPlans((rows ?? []) as PlanRow[]));
  }, [loadPlans]);

  const plan = plans.find((p) => p.code === planCode) ?? null;
  const amount = plan ? (cycle === "annuel" ? plan.prix_gnf * 10 : plan.prix_gnf) : 0;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const codeOk = /^\d{6}$/.test(emailCode.trim()) && codeSentTo === email.trim().toLowerCase();

  const onSendCode = async () => {
    if (!emailOk) return;
    setSendingCode(true);
    try {
      await requestCode({ data: { email: email.trim() } });
      setCodeSentTo(email.trim().toLowerCase());
      setEmailCode("");
      toast.success(t("paiement.codeSent"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("paiement.codeSendError"));
    } finally {
      setSendingCode(false);
    }
  };

  const onPay = async () => {
    if (!plan || !method || !emailOk || !codeOk || !isValidGnPhone(payerNumber)) return;
    setSubmitting(true);
    try {
      const res: any = await startPayment({
        data: {
          planCode,
          cycle,
          paymentMethod: method,
          payerNumber: digits(payerNumber).replace(/^224/, ""),
          email: email.trim(),
          emailCode: emailCode.trim(),
        },
      });
      savePendingClaim(res.claimToken);
      if (method === "card" && res.redirectUrl) {
        window.location.href = res.redirectUrl;
        return;
      }
      setClaimToken(res.claimToken);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("paiement.startingPaymentError"));
    } finally {
      setSubmitting(false);
    }
  };

  if (claimToken) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
        <Logo />
        <div className="space-y-1">
          <h1 className="text-2xl font-black">{t("paiement.validateOnPhone")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("paiement.requestSentTo", { amount: gnf(amount), phone: digits(payerNumber).slice(-9) })}{" "}
            {t("paiement.dialConfirmation")}
          </p>
        </div>

        <PaymentStatusTracker
          claimToken={claimToken}
          extraActions={
            <Button asChild variant="ghost" size="sm">
              <Link to="/paiement/suivi" search={{ claim: claimToken }}>
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


  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <Logo />
      <div className="space-y-1">
        <h1 className="text-2xl font-black">{t("paiement.payTitle")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("paiement.paySubtitle")}
        </p>
      </div>

      <Card>
        <CardContent className="space-y-6 p-6">
          <PlanPicker plans={plans} planCode={planCode} onSelect={setPlanCode} />
          <CyclePicker cycle={cycle} onSelect={setCycle} />
          <AmountSummary amount={amount} planName={plan?.nom ?? null} cycle={cycle} />

          <div className="space-y-2">
            <Label htmlFor="email">{t("paiement.emailLabel")}</Label>
            <Input
              id="email"
              type="email"
              maxLength={255}
              placeholder={t("paiement.emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {email && !emailOk && (
              <p className="text-xs text-destructive">{t("paiement.emailInvalid")}</p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="email-code"
                inputMode="numeric"
                maxLength={6}
                aria-label={t("paiement.codeLabel")}
                placeholder={t("paiement.codePlaceholder")}
                value={emailCode}
                onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                disabled={!codeSentTo}
              />
              <Button
                type="button"
                variant="outline"
                disabled={!emailOk || sendingCode}
                onClick={() => void onSendCode()}
              >
                {sendingCode && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {codeSentTo ? t("paiement.resendCode") : t("paiement.sendCode")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t("paiement.codeHint")}</p>
          </div>

          {!method ? (
            <MethodPicker onSelect={setMethod} />
          ) : (
            <div className="space-y-4">
              <SelectedMethodBar method={method} onChange={() => setMethod(null)} />

              <div className="space-y-2">
                <Label htmlFor="payer">
                  {method === "card"
                    ? t("paiement.payerPhoneCardLabel")
                    : t("paiement.payerPhoneMomoLabel")}
                </Label>
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
                  <p className="text-xs text-destructive">
                    {t("paiement.phoneInvalid")}
                  </p>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                {method === "card" ? t("paiement.cardHint") : t("paiement.momoHint")}
              </p>

              <Button
                className="w-full"
                disabled={submitting || !plan || !emailOk || !codeOk || !isValidGnPhone(payerNumber)}
                onClick={() => void onPay()}
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {method === "card"
                  ? t("paiement.continueToCard")
                  : t("paiement.payAmount", { amount: gnf(amount) })}
              </Button>
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground">
            {t("paiement.alreadyAccount")}{" "}
            <Link to="/login" className="font-semibold text-primary underline-offset-4 hover:underline">
              {t("paiement.signIn")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
