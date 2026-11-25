import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import type { PendingClaim } from "@/lib/api/billing-public";
import { PaymentStatusTracker } from "@/components/billing/PaymentStatusTracker";
import { Logo } from "@/components/brand/Logo";
import {
  CLAIM_TOKEN,
  PAYMENT_REF,
  claimFromSearch,
  peekPendingClaim,
  savePendingClaim,
} from "@/lib/pending-claim";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    ref: typeof search.ref === "string" ? search.ref : "",
    claim: typeof search.claim === "string" ? search.claim : "",
  }),
  component: PaymentTrackingPage,
});

function PaymentTrackingPage() {
  const { t } = useTranslation();
  const search = useSearch({ from: "/paiement/suivi" });
  const [claim, setClaim] = useState<PendingClaim | null>(null);
  const [ref, setRef] = useState(search.ref);
  const [token, setToken] = useState("");

  useEffect(() => {
    const fromLink = claimFromSearch(search);
    if (fromLink) {
      savePendingClaim(fromLink);
      setClaim(fromLink);
      return;
    }
    const stored = peekPendingClaim();
    if (stored && (!search.ref || stored.ref === search.ref)) {
      setRef(stored.ref);
      setToken(stored.token);
    }
  }, [search]);

  const refOk = PAYMENT_REF.test(ref.trim());
  const tokenOk = CLAIM_TOKEN.test(token.trim());

  const show = (e: FormEvent) => {
    e.preventDefault();
    if (!refOk || !tokenOk) return;
    const next = { ref: ref.trim(), token: token.trim() };
    savePendingClaim(next);
    setClaim(next);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <Logo />
      <div className="space-y-1">
        <h1 className="text-2xl font-black">{t("paiement.suiviTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("paiement.suiviSubtitle")}</p>
      </div>

      {claim ? (
        <PaymentStatusTracker
          claim={claim}
          extraActions={
            <Button variant="ghost" size="sm" onClick={() => setClaim(null)}>
              {t("paiement.trackAnother")}
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-6">
            <form className="space-y-4" onSubmit={show}>
              <div className="space-y-2">
                <Label htmlFor="payment-ref">{t("paiement.refLabel")}</Label>
                <Input
                  id="payment-ref"
                  placeholder="00000000-0000-0000-0000-000000000000"
                  value={ref}
                  onChange={(e) => setRef(e.target.value)}
                />
                {ref && !refOk && (
                  <p className="text-xs text-destructive">{t("paiement.refInvalid")}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="claim">{t("paiement.claimLabel")}</Label>
                <Input
                  id="claim"
                  placeholder="clm_…"
                  autoComplete="off"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
                {token && !tokenOk && (
                  <p className="text-xs text-destructive">{t("paiement.claimInvalid")}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={!refOk || !tokenOk}>
                {t("paiement.showStatus")}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <p className="text-center text-xs text-muted-foreground">
        {t("paiement.notPaidYet")}{" "}
        <Link
          to="/paiement"
          search={{ plan: "starter", cycle: "mensuel" }}
          className="font-semibold text-primary underline-offset-4 hover:underline"
        >
          {t("paiement.choosePlan")}
        </Link>
      </p>
    </div>
  );
}
