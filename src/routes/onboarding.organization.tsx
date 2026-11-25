import { takePendingPlan } from "@/lib/pending-plan";
import { peekPendingClaim, clearPendingClaim } from "@/lib/pending-claim";
import { claimPresignupPayment, type ClaimRule, type PendingClaim } from "@/lib/api/billing-public";
import { PaymentStatusTracker } from "@/components/billing/PaymentStatusTracker";
import type { ClaimSummary } from "@/hooks/usePaymentClaimStatus";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { createOrganization } from "@/lib/api/auth";
import { apiErrorMessage, isApiError } from "@/lib/api/client";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  // A payment made before sign-up: this page creates its organization, even
  // for an account that already has one.
  // `undefined` until the browser storage has been read.
  const [claim, setClaim] = useState<PendingClaim | null | undefined>(undefined);
  useEffect(() => setClaim(peekPendingClaim()), []);

  useEffect(() => {
    if (!authLoading && !user) nav({ to: "/login", search: {} });
  }, [authLoading, user, nav]);

  useEffect(() => {
    if (!orgLoading && org && claim === null && !submitted.current) nav({ to: "/app" });
  }, [orgLoading, org, claim, nav]);

  if (authLoading || !user || claim === undefined) return <SplashScreen />;
  if (!user.emailVerified) return <VerifyEmailGate email={user.email} />;
  if (claim) {
    return (
      <ClaimForm
        claim={claim}
        hasOrganization={!!org}
        submitted={submitted}
        onDismiss={() => setClaim(null)}
      />
    );
  }
  return <OrganizationForm submitted={submitted} />;
}

const claimRule = (error: unknown): ClaimRule | null => {
  if (!isApiError(error, "E_CLAIM_INVALID")) return null;
  const rule = error.details[0]?.rule;
  return rule === "notPaid" || rule === "used" || rule === "expired" || rule === "email"
    ? rule
    : null;
};

/**
 * Uses a payment made before sign-up (`POST /public/payments/:ref/claim`):
 * either for a new organization, of which the caller becomes owner, or for an
 * organization the caller already owns (06 §11).
 */
function ClaimForm({
  claim,
  hasOrganization,
  submitted,
  onDismiss,
}: {
  claim: PendingClaim;
  hasOrganization: boolean;
  submitted: RefObject<boolean>;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const { organizations, selectOrganization } = useOrg();
  const nav = useNavigate();
  const owned = organizations.filter((o) => o.roles.includes("owner"));
  const [target, setTarget] = useState<"existing" | "new">(owned.length > 0 ? "existing" : "new");
  const [organizationId, setOrganizationId] = useState(owned[0]?.id ?? "");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<ClaimSummary | null>(null);
  const claimable = summary?.status === "succeeded" && summary.claimable;
  const toExisting = target === "existing" && owned.length > 0;
  const ready = toExisting ? !!organizationId : name.trim().length >= 2;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    submitted.current = true;
    try {
      const result = await claimPresignupPayment(
        claim.ref,
        toExisting
          ? { claimToken: claim.token, organizationId }
          : { claimToken: claim.token, organizationName: name.trim() },
      );
      clearPendingClaim();
      // Reloads `/me` and clears the cache: plan and modules of the organization change.
      await selectOrganization(result.id);
      toast.success(toExisting ? t("onboarding.claimAttached") : t("onboarding.claimActivated"));
      nav({ to: "/app/billing" });
    } catch (err) {
      submitted.current = false;
      setLoading(false);
      const rule = claimRule(err);
      if (rule === "used" || rule === "expired") {
        // The code can no longer be used: forget it and fall back to a normal creation.
        clearPendingClaim();
        toast.error(t(`onboarding.claimRule.${rule}`), { duration: 8000 });
        onDismiss();
        return;
      }
      if (rule) {
        toast.error(t(`onboarding.claimRule.${rule}`, { email: summary?.emailMasked ?? "" }), {
          duration: 8000,
        });
        return;
      }
      if (toExisting && (isApiError(err, "E_FORBIDDEN") || isApiError(err, "E_NOT_FOUND"))) {
        // Not owner (any more) of this organization: the code stays usable.
        toast.error(t("onboarding.claimNotOwner"));
        return;
      }
      if (isApiError(err, "E_NOT_FOUND")) {
        clearPendingClaim();
        toast.error(t("onboarding.claimNotFound"));
        onDismiss();
        return;
      }
      toast.error(apiErrorMessage(err));
    }
  };

  /** Keeps the code: the payment can still be used later from this page. */
  const later = () => {
    if (hasOrganization) {
      nav({ to: "/app" });
      return;
    }
    onDismiss();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-grid-soft px-4 py-10">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <Logo className="mb-2" />
          <CardTitle className="font-display text-2xl">
            {owned.length > 0 ? t("onboarding.claimTitleChoice") : t("onboarding.claimTitle")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {owned.length > 0
              ? t("onboarding.claimSubtitleChoice")
              : hasOrganization
                ? t("onboarding.claimSubtitleExisting")
                : t("onboarding.claimSubtitle")}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <PaymentStatusTracker claim={claim} compact hideActions onStatus={setSummary} />
          <form onSubmit={submit} className="space-y-4">
            {owned.length > 0 && (
              <RadioGroup
                value={target}
                onValueChange={(value) => setTarget(value as "existing" | "new")}
                aria-label={t("onboarding.claimTargetLabel")}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="existing" id="target-existing" />
                  <Label htmlFor="target-existing">{t("onboarding.claimTargetExisting")}</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="new" id="target-new" />
                  <Label htmlFor="target-new">{t("onboarding.claimTargetNew")}</Label>
                </div>
              </RadioGroup>
            )}
            {toExisting ? (
              <div className="space-y-2">
                <Label htmlFor="organization">{t("onboarding.claimOrganization")}</Label>
                <Select value={organizationId} onValueChange={setOrganizationId}>
                  <SelectTrigger id="organization">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {owned.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t("onboarding.claimExistingHint")}</p>
              </div>
            ) : (
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
            )}
            <Button type="submit" className="w-full" disabled={loading || !claimable || !ready}>
              {loading
                ? t("onboarding.submitting")
                : toExisting
                  ? t("onboarding.claimSubmitExisting")
                  : t("onboarding.claimSubmit")}
            </Button>
          </form>
          <Button variant="ghost" className="w-full" onClick={later}>
            {hasOrganization ? t("onboarding.claimLater") : t("onboarding.claimWithout")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
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
  const { selectOrganization } = useOrg();
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
    setLoading(false);
    await selectOrganization(newOrgId);
    toast.success(t("onboarding.created"));
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
