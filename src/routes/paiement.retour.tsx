import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import type { PendingClaim } from "@/lib/api/billing-public";
import { claimFromSearch, peekPendingClaim } from "@/lib/pending-claim";
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

/**
 * Return from the Djomy card portal (`?ref=<merchantReference>`). The claim
 * code is not in the URL: it was kept in this browser before the redirect.
 * The status sent back by the provider is ignored, only the API's counts.
 */
function PrepaidReturn() {
  const { t } = useTranslation();
  const search = useSearch({ from: "/paiement/retour" });
  // `undefined` until the browser storage has been read.
  const [claim, setClaim] = useState<PendingClaim | null | undefined>(undefined);

  useEffect(() => {
    const stored = peekPendingClaim();
    setClaim(
      claimFromSearch(search) ??
        (stored && (!search.ref || stored.ref === search.ref) ? stored : null),
    );
  }, [search]);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-12">
      <Logo />
      <div className="space-y-1">
        <h1 className="text-2xl font-black">{t("paiement.retourTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("paiement.retourSubtitle")}</p>
      </div>

      {claim ? (
        <PaymentStatusTracker claim={claim} />
      ) : claim === null ? (
        <p className="text-sm text-muted-foreground">{t("paiement.missingClaim")}</p>
      ) : null}

      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link
            to="/paiement/suivi"
            search={claim ? { ref: claim.ref, claim: claim.token } : { ref: search.ref, claim: "" }}
          >
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
