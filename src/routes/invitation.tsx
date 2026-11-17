import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { acceptInvitation, getInvitation, type InvitationPreview } from "@/lib/api/auth";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PasswordStrength, scorePassword } from "@/components/auth/PasswordStrength";
import { Logo } from "@/components/brand/Logo";
import i18n, { authErrorKey } from "@/lib/i18n";
import { toast } from "sonner";

export const Route = createFileRoute("/invitation")({
  head: () => ({
    meta: [
      { title: i18n.t("auth.invitationMetaTitle") },
      { name: "description", content: i18n.t("auth.invitationMetaDescription") },
      { property: "og:title", content: i18n.t("auth.invitationMetaTitle") },
      { property: "og:description", content: i18n.t("auth.invitationMetaDescription") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InvitationPage,
});

/**
 * Invitation link `/invitation?token=…` (06-api-reference §1). A new account
 * chooses its password; an existing account confirms its current password and
 * simply gains the role.
 */
function InvitationPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { reload } = useAuth();
  const [ready, setReady] = useState(false);
  const [invitation, setInvitation] = useState<InvitationPreview | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const tk = new URLSearchParams(window.location.search).get("token");
    setToken(tk);
    if (!tk) {
      setReady(true);
      return;
    }
    getInvitation(tk)
      .then((inv) => {
        if (!cancelled) setInvitation(inv);
      })
      .catch(() => {
        if (!cancelled) setInvitation(null);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const existing = invitation?.accountExists ?? false;
  const strength = scorePassword(pwd);
  const mismatch = !existing && confirm.length > 0 && confirm !== pwd;
  const canSubmit =
    !saving && (existing ? pwd.length > 0 : pwd.length >= 10 && strength >= 2 && pwd === confirm);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !token || !invitation) return;
    setSaving(true);
    try {
      await acceptInvitation(token, {
        password: pwd,
        // An existing account types its password once.
        password_confirmation: existing ? pwd : confirm,
        ...(!existing && fullName.trim().length >= 2 ? { fullName: fullName.trim() } : {}),
      });
      await reload();
    } catch (error) {
      toast.error(t(authErrorKey(error)));
      return;
    } finally {
      setSaving(false);
    }
    toast.success(
      existing
        ? t("auth.joinedSuccess", { organization: invitation.organizationName })
        : t("auth.passwordSetSuccess"),
    );
    nav({ to: "/app", replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4 sm:p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <Logo className="mb-2" />
          <CardTitle className="text-xl">{t("auth.invitationTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {!ready && <p className="text-sm text-muted-foreground">{t("auth.checkingLink")}</p>}

          {ready && !invitation && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{t("auth.invalidLink")}</p>
              <Button variant="outline" onClick={() => nav({ to: "/login", search: {} })}>
                {t("auth.backToLogin")}
              </Button>
            </div>
          )}

          {ready && invitation && (
            <form onSubmit={submit} className="space-y-4">
              <p className="text-sm font-medium text-foreground">
                {t("auth.invitationJoin", {
                  organization: invitation.organizationName,
                  role: t(`auth.roles.${invitation.role}`, { defaultValue: invitation.role }),
                })}
              </p>
              <p className="text-sm text-muted-foreground">
                {t(existing ? "auth.existingAccountIntro" : "auth.newAccountIntro", {
                  email: invitation.email,
                })}
              </p>

              {!existing && (
                <div className="space-y-2">
                  <Label htmlFor="fullName">{t("auth.fullName")}</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    autoComplete="name"
                    maxLength={120}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="pwd">
                  {t(existing ? "auth.currentPassword" : "auth.newPassword")}
                </Label>
                <PasswordInput
                  id="pwd"
                  value={pwd}
                  onChange={(e) => setPwd(e.target.value)}
                  autoComplete={existing ? "current-password" : "new-password"}
                  required
                />
                {!existing && <PasswordStrength value={pwd} />}
              </div>

              {!existing && (
                <div className="space-y-2">
                  <Label htmlFor="confirm">{t("auth.confirmPassword")}</Label>
                  <PasswordInput
                    id="confirm"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                  {mismatch && (
                    <p className="text-xs text-destructive">{t("auth.passwordMismatch")}</p>
                  )}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={!canSubmit}>
                {t(existing ? "auth.submitJoin" : "auth.submitPassword")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
