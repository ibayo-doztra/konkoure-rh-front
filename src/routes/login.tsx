import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/brand/Logo";
import { toast } from "sonner";
import { PasswordInput } from "@/components/auth/PasswordInput";
import i18n, { authErrorKey } from "@/lib/i18n";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { next?: string } =>
    typeof s.next === "string" ? { next: s.next } : {},

  head: () => ({
    meta: [
      { title: i18n.t("auth.loginMetaTitle") },
      { name: "description", content: "Connectez-vous à votre espace Konkouré pour gérer recrutement, performance et pointage de vos équipes." },
      { property: "og:title", content: i18n.t("auth.loginMetaTitle") },
      { property: "og:description", content: "Accédez à votre compte Konkouré SIRH." },
      { property: "og:url", content: "https://konkoure.lovable.app/login" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://konkoure.lovable.app/login" }],
  }),
  component: LoginPage,
});

// Only accept same-origin relative paths, to avoid open-redirect vectors.
function safeNext(next: string | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || /[\\\s]/.test(next)) return null;
  try {
    const u = new URL(next, window.location.origin);
    if (u.origin !== window.location.origin) return null;
    return u.pathname + u.search + u.hash;
  } catch {
    return null;
  }
}

function LoginPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { next } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (error) {
      toast.error(t(authErrorKey(error)));
      return;
    } finally {
      setLoading(false);
    }
    const target = safeNext(next);
    if (target) {
      window.location.href = target;
      return;
    }
    nav({ to: "/app" });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-grid-soft px-4">
      <h1 className="sr-only">{t("auth.loginTitle")}</h1>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Logo className="mx-auto mb-2" />
          <CardTitle className="font-display text-2xl">{t("auth.loginTitle")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("auth.loginSubtitle")}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("common.email")}</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t("common.password")}</Label>
                <Link to="/reset-password" className="text-xs text-primary hover:underline">
                  {t("auth.forgotLink")}
                </Link>
              </div>
              <PasswordInput id="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "…" : t("auth.submitLogin")}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t("auth.noAccount")}{" "}
            <Link to="/signup" className="text-primary hover:underline">
              {t("auth.createAccount")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
