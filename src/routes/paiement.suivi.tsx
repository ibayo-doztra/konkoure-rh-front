import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { PaymentStatusTracker } from "@/components/billing/PaymentStatusTracker";
import { Logo } from "@/components/brand/Logo";
import { peekPendingClaim, savePendingClaim } from "@/lib/pending-claim";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/paiement/suivi")({
  head: () => ({
    meta: [
      { title: i18n.t("paiement.metaSuiviTitle") },
      { name: "description", content: i18n.t("paiement.metaSuiviDesc") },
      { property: "og:title", content: i18n.t("paiement.metaSuiviTitle") },
      { property: "og:description", content: i18n.t("paiement.metaSuiviOgDesc") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    claim: typeof search.claim === "string" ? search.claim : "",
  }),
  component: PaymentTrackingPage,
});

function PaymentTrackingPage() {
  const { t } = useTranslation();
  const { claim } = useSearch({ from: "/paiement/suivi" });
  const [token, setToken] = useState(claim);
  const [input, setInput] = useState("");

  useEffect(() => {
    if (claim && UUID.test(claim)) {
      savePendingClaim(claim);
      setToken(claim);
      return;
    }
    const stored = peekPendingClaim();
    if (stored) setInput(stored);
  }, [claim]);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <Logo />
      <div className="space-y-1">
        <h1 className="text-2xl font-black">{t("paiement.suiviTitle")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("paiement.suiviSubtitle")}
        </p>
      </div>

      {UUID.test(token) ? (
        <PaymentStatusTracker claimToken={token} />
      ) : (
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="space-y-2">
              <Label htmlFor="claim">{t("paiement.claimLabel")}</Label>
              <Input
                id="claim"
                placeholder="00000000-0000-0000-0000-000000000000"
                value={input}
                onChange={(e) => setInput(e.target.value.trim())}
              />
              {input && !UUID.test(input) && (
                <p className="text-xs text-destructive">
                  {t("paiement.claimInvalid")}
                </p>
              )}
            </div>
            <Button
              className="w-full"
              disabled={!UUID.test(input)}
              onClick={() => setToken(input)}
            >
              {t("paiement.showStatus")}
            </Button>
          </CardContent>
        </Card>
      )}

      <p className="text-center text-xs text-muted-foreground">
        {t("paiement.notPaidYet")}{" "}
        <Link
          to="/paiement"
          search={{ plan: "essentiel", cycle: "mensuel" }}
          className="font-semibold text-primary underline-offset-4 hover:underline"
        >
          {t("paiement.choosePlan")}
        </Link>
      </p>
    </div>
  );
}
