import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PaymentProgress } from "@/components/billing/PaymentProgress";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/billing/return")({
  head: () => ({
    meta: [
      { title: "Confirmation de paiement — Konkouré RH" },
      { name: "description", content: "Confirmation du paiement de votre abonnement Konkouré RH." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  // Return of the Djomy card portal: `?payment=<paymentId>` (06 §10). Any status
  // the provider adds to the URL is ignored: only the API's one counts.
  validateSearch: (search: Record<string, unknown>) => ({
    payment: typeof search.payment === "string" ? search.payment : "",
  }),
  component: BillingReturn,
});

function BillingReturn() {
  const { t } = useTranslation();
  const { payment } = useSearch({ from: "/_authenticated/app/billing/return" });
  return (
    <div className="mx-auto max-w-lg py-16">
      {payment ? (
        <PaymentProgress paymentId={payment} />
      ) : (
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">{t("return.missingPayment")}</p>
          <Button asChild variant="outline">
            <Link to="/app/billing">{t("return.backToBilling")}</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
