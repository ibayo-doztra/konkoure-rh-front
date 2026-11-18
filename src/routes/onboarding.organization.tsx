import { takePendingPlan } from "@/lib/pending-plan";
import { peekPendingClaim, clearPendingClaim } from "@/lib/pending-claim";
import { claimPrepaidPayment } from "@/lib/api/legacy-functions";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { createOrganization } from "@/lib/api/auth";
import { isApiError } from "@/lib/api/client";
import { humanizeDbError } from "@/lib/db-errors";
import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/hooks/useOrg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResendVerificationButton } from "@/components/auth/ResendVerificationButton";
import { Logo } from "@/components/brand/Logo";
import { SplashScreen } from "@/components/SplashScreen";
import { toast } from "sonner";

import i18n from "@/lib/i18n";

export const Route = createFileRoute("/onboarding/organization")({
  head: () => ({
    meta: [
      { title: i18n.t("onboarding.metaTitle") },
      { name: "description", content: i18n.t("onboarding.metaDescription") },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OrgOnboarding,
});

function OrgOnboarding() {
  const { user, loading: authLoading } = useAuth();
  const { org, loading: orgLoading } = useOrg();
  const nav = useNavigate();
  // Once the form is submitted, `submit` picks the destination (billing, checkout, app).
  const submitted = useRef(false);

  useEffect(() => {
    if (!authLoading && !user) nav({ to: "/login", search: {} });
  }, [authLoading, user, nav]);

  useEffect(() => {
    if (!orgLoading && org && !submitted.current) nav({ to: "/app" });
  }, [orgLoading, org, nav]);

  if (authLoading || !user) return <SplashScreen />;
  if (!user.emailVerified) return <VerifyEmailGate email={user.email} />;
  return <OrganizationForm submitted={submitted} />;
}

/** `POST /organizations` requires a verified address (06-api-reference §3). */
function VerifyEmailGate({ email }: { email: string }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { reload, signOut } = useAuth();
  const [checking, setChecking] = useState(false);

  const check = async () => {
    setChecking(true);
    const me = await reload();
    setChecking(false);
    if (me && !me.user.emailVerified) toast.info(t("onboarding.stillNotVerified"));
  };

  const switchAccount = async () => {
    await signOut();
    nav({ to: "/login", search: {}, replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-grid-soft px-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <Logo className="mb-2" />
          <CardTitle className="font-display text-2xl">{t("onboarding.verifyTitle")}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("onboarding.verifyBody", { email, interpolation: { escapeValue: false } })}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full" disabled={checking} onClick={check}>
            {t("onboarding.verifiedCheck")}
          </Button>
          <ResendVerificationButton className="w-full" />
          <Button variant="ghost" className="w-full" onClick={switchAccount}>
            {t("onboarding.useAnotherAccount")}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

function OrganizationForm({ submitted }: { submitted: RefObject<boolean> }) {
  const { t } = useTranslation();
  const { reload } = useAuth();
  const { refresh } = useOrg();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("fr");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    submitted.current = true;
    let newOrgId: string;
    try {
      // POST /organizations (06 §3). The slug, the "sap" performance model and the
      // default departments are set server-side (00-HANDOFF §4).
      const res = await createOrganization({
        name: name.trim(),
        defaultLanguage: language === "en" ? "en" : "fr",
      });
      newOrgId = res.id;
    } catch (err) {
      submitted.current = false;
      setLoading(false);
      if (isApiError(err, "E_EMAIL_NOT_VERIFIED")) {
        // Stale session state: re-reading `/me` brings the verification screen back.
        toast.error(t("auth.errors.emailNotConfirmed"));
        await reload();
        return;
      }
      toast.error(humanizeDbError(err, t("onboarding.errorCreate")));
      return;
    }
    // Subscription paid before the account existed: attach it now.
    const claimToken = peekPendingClaim();
    let claimed = false;
    if (claimToken) {
      try {
        const res = await claimPrepaidPayment({
          data: { claimToken, organizationId: newOrgId },
        });
        claimed = !!res?.claimed;
        if (claimed) {
          clearPendingClaim();
          toast.success(t("onboarding.claimActivated"));
        } else if (res?.reason === "EMAIL_MISMATCH") {
          toast.error(t("onboarding.claimEmailMismatch"), { duration: 8000 });
        } else if (res?.reason === "NOT_PAID") {
          toast.warning(t("onboarding.claimNotConfirmed"), { duration: 8000 });
        } else if (res?.reason === "NOT_FOUND") {
          clearPendingClaim();
          toast.error(t("onboarding.claimNotFound"));
        } else if (res?.reason === "ALREADY_CLAIMED") {
          clearPendingClaim();
        }
      } catch {
        toast.error(t("onboarding.claimAttachError"));
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
              <Input
                id="name"
                required
                minLength={2}
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("onboarding.defaultLanguage")}</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fr">Français</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="w-full" disabled={loading || name.trim().length < 2}>
              {loading ? t("onboarding.submitting") : t("onboarding.submit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
