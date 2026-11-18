import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { forgotPassword, resetPassword } from "@/lib/api/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: i18n.t("auth.resetMetaTitle") },
      { name: "description", content: i18n.t("auth.resetMetaDescription") },
      { property: "og:url", content: "https://konkoure.doztra.cloud/reset-password" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://konkoure.doztra.cloud/reset-password" }],
  }),
  component: ResetPage,
});

function ResetPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  // The API e-mails a link to /reset-password?token=… (06 §1 POST /auth/forgot-password).
  const [token, setToken] = useState<string | null>(null);
  const recovery = token !== null;
  const [loading, setLoading] = useState(false);

  const validPassword = meetsPasswordPolicy(newPwd);
  const mismatch = confirmPwd.length > 0 && confirmPwd !== newPwd;
  const canUpdate = !loading && validPassword && newPwd === confirmPwd;

  useEffect(() => {
    if (typeof window === "undefined") return;
    setToken(new URLSearchParams(window.location.search).get("token"));
  }, []);

  const sendReset = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await forgotPassword(email);
      toast.success(t("auth.resetEmailSent"));
    } catch (error) {
      toast.error(t(authErrorKey(error)));
    } finally {
      setLoading(false);
    }
  };

  const updatePwd = async (e: FormEvent) => {
    e.preventDefault();
    if (newPwd !== confirmPwd) {
      toast.error(t("auth.passwordMismatch"));
      return;
    }
    if (!validPassword) {
      toast.error(t("auth.passwordTooWeak"));
      return;
    }
    setLoading(true);
    try {
      await resetPassword({ token: token!, password: newPwd, password_confirmation: confirmPwd });
      toast.success(t("auth.passwordUpdated"));
      window.location.href = "/login";
    } catch (error) {
      toast.error(t(authErrorKey(error)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-grid-soft px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <Logo className="mb-2" />
          <CardTitle className="font-display text-2xl">
            {recovery ? t("auth.resetNewTitle") : t("auth.resetTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recovery ? (
            <form onSubmit={updatePwd} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newp">{t("auth.newPassword")}</Label>
                <PasswordInput
                  id="newp"
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  maxLength={128}
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                />
                <PasswordStrength value={newPwd} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confp">{t("auth.confirmPassword")}</Label>
                <PasswordInput
                  id="confp"
                  required
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  aria-invalid={mismatch || undefined}
                />
                {mismatch && (
                  <p className="text-xs text-destructive">{t("auth.passwordMismatch")}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={!canUpdate}>
                {t("auth.updatePassword")}
              </Button>
            </form>
          ) : (
            <form onSubmit={sendReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t("common.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {t("auth.sendResetLink")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
