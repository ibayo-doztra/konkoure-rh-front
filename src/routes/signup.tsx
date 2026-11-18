import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { savePendingClaim } from "@/lib/pending-claim";
import { PaymentStatusTracker } from "@/components/billing/PaymentStatusTracker";
import { useTranslation } from "react-i18next";
import { register } from "@/lib/api/auth";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordInput } from "@/components/auth/PasswordInput";
import {
  meetsPasswordPolicy,
  PASSWORD_MIN_LENGTH,
  PasswordStrength,
} from "@/components/auth/PasswordStrength";
import { Logo } from "@/components/brand/Logo";
import { toast } from "sonner";
import i18n, { authErrorKey } from "@/lib/i18n";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: i18n.t("auth.signupMetaTitle") },
      { name: "description", content: i18n.t("auth.signupMetaDescription") },
      { property: "og:title", content: i18n.t("auth.signupMetaTitle") },
      { property: "og:description", content: i18n.t("auth.signupMetaDescription") },
      { property: "og:url", content: "https://konkoure.doztra.cloud/signup" },
    ],
    links: [{ rel: "canonical", href: "https://konkoure.doztra.cloud/signup" }],
  }),
  validateSearch: (search: Record<string, unknown>): { claim?: string; email?: string } => ({
    ...(typeof search.claim === "string" ? { claim: search.claim } : {}),
    ...(typeof search.email === "string" ? { email: search.email } : {}),
  }),
  component: SignupPage,
});

function SignupPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { claim, email: prefilledEmail } = useSearch({ from: "/signup" });
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(prefilledEmail ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const { reload } = useAuth();
  const [acceptTerms, setAcceptTerms] = useState(false);

  // Paiement effectué avant la création du compte : on mémorise le code de
  // rattachement pour activer l'abonnement dès que l'organisation existe.
  useEffect(() => {
    if (claim) savePendingClaim(claim);
  }, [claim]);

  const validPassword = meetsPasswordPolicy(password);
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = !loading && acceptTerms && validPassword && password === confirm;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error(t("auth.passwordMismatch"));
      return;
    }
    if (!validPassword) {
      toast.error(t("auth.passwordTooWeak"));
      return;
    }
    setLoading(true);
    try {
      await register({
        email,
        password,
        password_confirmation: confirm,
        fullName,
        preferredLanguage: (i18n.resolvedLanguage ?? "fr").startsWith("en") ? "en" : "fr",
        acceptTerms,
      });
      await reload();
    } catch (error) {
      toast.error(t(authErrorKey(error)));
      return;
    } finally {
      setLoading(false);
    }
    // POST /auth/register opens a session; e-mail verification is required before
    // creating an organization (06 §3), the API sends the verification e-mail.
    toast.success(t("auth.confirmEmail"));
    nav({ to: "/onboarding/organization" });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-grid-soft px-4">
      <h1 className="sr-only">{t("auth.signupTitle")}</h1>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Logo className="mx-auto mb-2" />
          <CardTitle className="font-display text-2xl">{t("auth.signupTitle")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("auth.signupSubtitle")}</p>
          {claim && (
            <div className="mt-3 space-y-2 text-left">
              <p className="rounded-md border border-primary/40 bg-accent/40 px-3 py-2 text-xs text-muted-foreground">
                {t("auth.claimHint")}
              </p>
              <PaymentStatusTracker claimToken={claim} compact hideActions />
            </div>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">{t("auth.fullName")}</Label>
              <Input
                id="full_name"
                required
                minLength={2}
                maxLength={120}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.workEmail")}</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("common.password")}</Label>
              <PasswordInput
                id="password"
                required
                minLength={PASSWORD_MIN_LENGTH}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <PasswordStrength value={password} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">{t("auth.confirmPassword")}</Label>
              <PasswordInput
                id="confirm"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                aria-invalid={mismatch || undefined}
              />
              {mismatch && <p className="text-xs text-destructive">{t("auth.passwordMismatch")}</p>}
            </div>
            <div className="flex items-start gap-2">
              <Checkbox
                id="accept-terms"
                checked={acceptTerms}
                onCheckedChange={(v) => setAcceptTerms(v === true)}
                className="mt-0.5"
              />
              <Label
                htmlFor="accept-terms"
                className="text-sm font-normal leading-snug text-muted-foreground"
              >
                {t("auth.acceptTerms")}
              </Label>
            </div>
            <Button type="submit" className="w-full" disabled={!canSubmit}>
              {loading ? "…" : t("auth.submitSignup")}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t("auth.haveAccount")}{" "}
            <Link to="/login" className="text-primary hover:underline">
              {t("auth.submitLogin")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
