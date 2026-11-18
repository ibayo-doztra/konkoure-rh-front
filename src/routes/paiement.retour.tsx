import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { savePendingClaim } from "@/lib/pending-claim";
import { PaymentStatusTracker } from "@/components/billing/PaymentStatusTracker";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/paiement/retour")({
  head: () => ({
    meta: [
      { title: i18n.t("paiement.metaRetourTitle") },
      { name: "description", content: i18n.t("paiement.metaRetourDesc") },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    ref: typeof search.ref === "string" ? search.ref : "",
    claim: typeof search.claim === "string" ? search.claim : "",
  }),
  component: PrepaidReturn,
});

function PrepaidReturn() {
  // Le statut renvoyé dans l'URL par le prestataire est ignoré :
  // seul le statut revalidé côté serveur fait foi.
  const { t } = useTranslation();
  const { claim } = useSearch({ from: "/paiement/retour" });

  useEffect(() => {
    if (claim) savePendingClaim(claim);
  }, [claim]);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-12">
      <Logo />
      <div className="space-y-1">
        <h1 className="text-2xl font-black">{t("paiement.retourTitle")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("paiement.retourSubtitle")}
        </p>
      </div>

      {claim ? (
        <PaymentStatusTracker claimToken={claim} />
      ) : (
        <p className="text-sm text-muted-foreground">
          {t("paiement.missingClaim")}
        </p>
      )}

      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to="/paiement/suivi" search={{ claim }}>
            {t("paiement.trackingPage")}
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link to="/paiement" search={{ plan: "starter", cycle: "mensuel" }}>
            {t("paiement.backToPayment")}
          </Link>
        </Button>
      </div>
    </div>
  );
}

