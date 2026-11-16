import { takePendingPlan } from "@/lib/pending-plan";
import { peekPendingClaim, clearPendingClaim } from "@/lib/pending-claim";
import { claimPrepaidPayment } from "@/lib/api/legacy-functions";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { createOrganization } from "@/lib/api/auth";
import { humanizeDbError } from "@/lib/db-errors";
import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/hooks/useOrg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Logo } from "@/components/brand/Logo";
import { toast } from "sonner";

import i18n from "@/lib/i18n";

export const Route = createFileRoute("/onboarding/organization")({
  head: () => ({
    meta: [
      { title: i18n.t("onboarding.metaTitle") },
      {
        name: "description",
        content:
          "Configurez votre organisation Konkouré : nom, slug, langue et modèle de performance pour démarrer votre espace RH en quelques minutes.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OrgOnboarding,
});

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

function OrgOnboarding() {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const { org, loading: orgLoading, refresh } = useOrg();
  const nav = useNavigate();
  const claimPayment = claimPrepaidPayment;

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [language, setLanguage] = useState("fr");
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) nav({ to: "/login" });
  }, [authLoading, user, nav]);

  useEffect(() => {
    if (!orgLoading && org) nav({ to: "/app" });
  }, [orgLoading, org, nav]);

  useEffect(() => setSlug(slugify(name)), [name]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    let newOrgId: string;
    try {
      // POST /organizations (06 §3). Performance model "sap" and the default
      // departments are set server-side (00-HANDOFF §4) — not sent by the client.
      const res = await createOrganization({
        name,
        slug,
        defaultLanguage: language === "en" ? "en" : "fr",
      });
      newOrgId = res.id;
    } catch (err) {
      setLoading(false);
      toast.error(humanizeDbError(err, t("onboarding.errorCreate")));
      return;
    }
    const orgData = { id: newOrgId };
    // Abonnement réglé avant la création du compte : on le rattache maintenant.
    const claimToken = peekPendingClaim();
    let claimed = false;
    if (claimToken) {
      try {
        const res: any = await claimPayment({
          data: { claimToken, organizationId: orgData.id },
        });
        claimed = !!res?.claimed;
        if (claimed) {
          clearPendingClaim();
          toast.success("Votre abonnement payé a été activé pour cette organisation.");
        } else if (res?.reason === "EMAIL_MISMATCH") {
          toast.error(
            "Le paiement a été effectué avec une autre adresse e-mail. Suivez son état sur /paiement/suivi avec votre code de suivi.",
            { duration: 8000 },
          );
        } else if (res?.reason === "NOT_PAID") {
          toast.warning(
            "Votre paiement n'est pas encore confirmé : suivez son état sur /paiement/suivi, l'abonnement sera activé ensuite.",
            { duration: 8000 },
          );
        } else if (res?.reason === "NOT_FOUND") {
          clearPendingClaim();
          toast.error("Le code de rattachement du paiement est introuvable.");
        } else if (res?.reason === "ALREADY_CLAIMED") {
          clearPendingClaim();
        }
      } catch {
        toast.error("Impossible de rattacher votre paiement pour le moment.");
      }
    }

    setLoading(false);
    await refresh();
    toast.success(t("onboarding.created"));
    if (claimed) {
      nav({ to: "/app/billing" });
      return;
    }
    const pending = takePendingPlan();
    if (pending) {
      nav({ to: "/app/billing/checkout", search: { plan: pending.plan, cycle: pending.cycle } });
      return;
    }
    nav({ to: "/app" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-grid-soft px-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <Logo className="mb-2" />
          <CardTitle className="font-display text-2xl">{t("onboarding.title")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("onboarding.subtitle")}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("onboarding.companyName")}</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">{t("onboarding.urlSlug")}</Label>
              <Input id="slug" required value={slug} onChange={(e) => setSlug(slugify(e.target.value))} />
              <p className="text-xs text-muted-foreground">
                {t("onboarding.urlHint", { slug: slug || t("onboarding.defaultPlaceholder") })}
              </p>
            </div>
            <div className="space-y-2">
              <Label>{t("onboarding.defaultLanguage")}</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fr">Français</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>


            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("onboarding.submitting") : t("onboarding.submit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
