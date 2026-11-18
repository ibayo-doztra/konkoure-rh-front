import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { verifyEmail } from "@/lib/api/auth";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResendVerificationButton } from "@/components/auth/ResendVerificationButton";
import { Logo } from "@/components/brand/Logo";
import i18n from "@/lib/i18n";

export const Route = createFileRoute("/verify-email")({
  validateSearch: (search: Record<string, unknown>): { token?: string } =>
    typeof search.token === "string" ? { token: search.token } : {},
  head: () => ({
    meta: [
      { title: i18n.t("auth.verifyEmailMetaTitle") },
      { name: "description", content: i18n.t("auth.verifyEmailMetaDescription") },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VerifyEmailPage,
});

type Status = "checking" | "verified" | "invalid";

/** Target of the link e-mailed by the API: `/verify-email?token=…` (06-api-reference §1). */
function VerifyEmailPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { token } = Route.useSearch();
  const { user, loading, reload } = useAuth();
  const [status, setStatus] = useState<Status>("checking");
  const started = useRef(false);

  useEffect(() => {
    // Wait for the session so that `/me` can be refreshed once the address is verified.
    if (loading || started.current) return;
    started.current = true;
    if (!token) {
      setStatus("invalid");
      return;
    }
    void (async () => {
      try {
        await verifyEmail(token);
        if (user) await reload();
        setStatus("verified");
      } catch {
        setStatus("invalid");
      }
    })();
  }, [loading, token, user, reload]);

  const goNext = () => {
    if (user) nav({ to: "/app", replace: true });
    else nav({ to: "/login", search: {}, replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-grid-soft px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <Logo className="mb-2" />
          <CardTitle className="font-display text-2xl">{t("auth.verifyEmailTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "checking" && (
            <p role="status" className="text-sm text-muted-foreground">
              {t("auth.verifyEmailChecking")}
            </p>
          )}

          {status === "verified" && (
            <>
              <p role="status" className="text-sm text-muted-foreground">
                {t("auth.verifyEmailSuccess")}
              </p>
              <Button className="w-full" onClick={goNext}>
                {t(user ? "auth.continue" : "auth.submitLogin")}
              </Button>
            </>
          )}

          {status === "invalid" && (
            <>
              <p role="alert" className="text-sm text-muted-foreground">
                {t("auth.verifyEmailInvalid")}
              </p>
              {user && !user.emailVerified ? (
                <ResendVerificationButton className="w-full" />
              ) : (
                <Button variant="outline" className="w-full" onClick={goNext}>
                  {t(user ? "auth.continue" : "auth.backToLogin")}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
