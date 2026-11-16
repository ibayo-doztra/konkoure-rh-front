import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { getPaymentStatus } from "@/lib/api/legacy-functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/app/billing/return")({
  head: () => ({
    meta: [
      { title: "Confirmation de paiement — Konkouré RH" },
      { name: "description", content: "Confirmation du paiement de votre abonnement Konkouré RH." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    ref: typeof search.ref === "string" ? search.ref : "",
  }),
  component: BillingReturn,
});

function BillingReturn() {
  const { t } = useTranslation();
  // Le paramètre `status` renvoyé par le prestataire est volontairement ignoré :
  // seul le statut lu en base (alimenté par le webhook signé) fait foi.
  const { ref } = useSearch({ from: "/_authenticated/app/billing/return" });
  const fetchStatus = getPaymentStatus;
  const [status, setStatus] = useState<string>("pending");
  const [attempts, setAttempts] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!ref) return;
    let cancelled = false;

    const poll = async (n: number) => {
      try {
        const row: any = await fetchStatus({ data: { merchantReference: ref } });
        if (cancelled) return;
        setStatus(row?.status ?? "pending");
        setAttempts(n);
        if ((row?.status ?? "pending") === "pending" && n < 20) {
          timer.current = setTimeout(() => void poll(n + 1), 3000);
        }
      } catch {
        if (!cancelled && n < 20) timer.current = setTimeout(() => void poll(n + 1), 3000);
      }
    };

    void poll(0);
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [ref, fetchStatus]);

  const success = status === "success";
  const failed = ["failed", "cancelled", "mismatch"].includes(status);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center justify-center py-16">
      <Card className="w-full">
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
              ? t("return.statusConfirmed")
              : failed
                ? t("return.statusFailed")
                : t("return.statusPending")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {success
              ? t("return.resultConfirmed")
              : failed
                ? t("return.resultFailed")
                : t("return.resultPending")}
          </p>
          {!success && !failed && attempts >= 20 && (
            <p className="text-xs text-muted-foreground">{t("return.waitingTooLong")}</p>
          )}
          <Button asChild variant={success ? "default" : "outline"}>
            <Link to="/app/billing">{t("return.backToBilling")}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
