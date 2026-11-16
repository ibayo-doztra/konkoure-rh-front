import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { acceptInvitation, getInvitation } from "@/lib/api/auth";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PasswordStrength, scorePassword } from "@/components/auth/PasswordStrength";
import { Logo } from "@/components/brand/Logo";
import { toast } from "sonner";

export const Route = createFileRoute("/invitation")({
  head: () => ({
    meta: [
      { title: "Activer mon compte — Konkouré RH" },
      {
        name: "description",
        content: "Définissez votre mot de passe pour activer votre accès à l'espace RH Konkouré.",
      },
      { property: "og:title", content: "Activer mon compte — Konkouré RH" },
      { property: "og:description", content: "Activation du compte employé Konkouré." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InvitationPage,
});

function InvitationPage() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const { reload } = useAuth();

  useEffect(() => {
    // Invitation link: /invitation?token=… → GET /auth/invitations/:token (06 §1).
    let cancelled = false;
    const tk = new URLSearchParams(window.location.search).get("token");
    setToken(tk);
    if (!tk) {
      setReady(true);
      return;
    }
    getInvitation(tk)
      .then((inv) => {
        if (cancelled) return;
        setHasSession(true);
        setEmail(inv.email);
      })
      .catch(() => {
        if (!cancelled) setHasSession(false);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const strength = scorePassword(pwd);
  const mismatch = confirm.length > 0 && confirm !== pwd;
  const canSubmit = !saving && pwd.length >= 8 && strength >= 2 && pwd === confirm;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    try {
      await acceptInvitation(token!, { password: pwd, password_confirmation: confirm });
      await reload();
    } catch (error) {
      toast.error((error as Error).message);
      return;
    } finally {
      setSaving(false);
    }
    toast.success("Mot de passe défini, bienvenue sur Konkouré !");
    nav({ to: "/app", replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <Logo className="mb-2" />
          <CardTitle className="text-xl">Activer mon compte</CardTitle>
        </CardHeader>
        <CardContent>
          {!ready && <p className="text-sm text-muted-foreground">Vérification du lien…</p>}

          {ready && !hasSession && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Ce lien d'invitation est invalide ou a expiré. Demandez à votre service RH de vous
                renvoyer une invitation, puis réessayez.
              </p>
              <Button variant="outline" onClick={() => nav({ to: "/login", search: {} })}>
                Retour à la connexion
              </Button>
            </div>
          )}

          {ready && hasSession && (
            <form onSubmit={submit} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Bienvenue{email ? ` ${email}` : ""} ! Pour continuer, choisissez votre mot de passe
                personnel.
              </p>
              <div className="space-y-2">
                <Label htmlFor="pwd">Nouveau mot de passe</Label>
                <PasswordInput
                  id="pwd"
                  value={pwd}
                  onChange={(e) => setPwd(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                <PasswordStrength value={pwd} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirmer le mot de passe</Label>
                <PasswordInput
                  id="confirm"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                {mismatch && (
                  <p className="text-xs text-destructive">Les mots de passe ne correspondent pas.</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={!canSubmit}>
                Définir mon mot de passe
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
