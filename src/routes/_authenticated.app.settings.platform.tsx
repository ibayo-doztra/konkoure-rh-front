import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useOrg } from "@/hooks/useOrg";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, ShieldAlert, Send } from "lucide-react";
import { toast } from "sonner";
import {
  getPlatformAdminStatus,
  updateRecruitmentWebhookConfig,
  pingRecruitmentWebhook,
} from "@/lib/api/legacy-functions";

export const Route = createFileRoute("/_authenticated/app/settings/platform")({
  component: PlatformSettingsPage,
});

function PlatformSettingsPage() {
  const { org } = useOrg();
  const { user, loading: authLoading } = useAuth();
  const getStatus = getPlatformAdminStatus;
  const getConfig = getPlatformAdminStatus;
  const updateConfig = updateRecruitmentWebhookConfig;
  const pingHook = pingRecruitmentWebhook;

  const statusQ = useQuery({
    queryKey: ["platform-admin-status", user?.id ?? null, org?.id],
    queryFn: async () => {
      try {
        return await getStatus({ data: { organizationId: org!.id } });
      } catch (error: any) {
        if (error instanceof Response && error.status === 401) {
          return { isPlatformAdmin: false };
        }
        if (error instanceof Error && /Unauthorized|authorization header/i.test(error.message)) {
          return { isPlatformAdmin: false };
        }
        throw error;
      }
    },
    enabled: !authLoading && !!user && !!org,
    retry: false,
  });
  const isAdmin = statusQ.data?.isPlatformAdmin === true;

  const configQ = useQuery({
    queryKey: ["recruitment-webhook-config", org?.id],
    queryFn: () => getConfig({ data: { organizationId: org!.id } }),
    enabled: !!org?.id && isAdmin,
  });

  const [testUrl, setTestUrl] = useState("");
  const [prodUrl, setProdUrl] = useState("");
  const [activeEnv, setActiveEnv] = useState<"off" | "test" | "prod">("off");
  const [saving, setSaving] = useState(false);
  const [pinging, setPinging] = useState<"test" | "prod" | null>(null);

  useEffect(() => {
    if (configQ.data && configQ.data.isPlatformAdmin) {
      setTestUrl(configQ.data.test_webhook_url ?? "");
      setProdUrl(configQ.data.prod_webhook_url ?? "");
      setActiveEnv((configQ.data.active_env as any) ?? "off");
    }
  }, [configQ.data]);

  if (authLoading || statusQ.isLoading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <PageHeader title="Plateforme" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <ShieldAlert className="h-10 w-10 text-destructive" />
            <h2 className="text-lg font-semibold">Accès restreint</h2>
            <p className="text-sm text-muted-foreground">Cette section est réservée au super administrateur de la plateforme.</p>
            <Button asChild variant="outline"><Link to="/app/settings">Retour aux paramètres</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const onSave = async () => {
    if (!org) return;
    setSaving(true);
    try {
      await updateConfig({
        data: {
          organizationId: org.id,
          test_webhook_url: testUrl.trim() || null,
          prod_webhook_url: prodUrl.trim() || null,
          active_env: activeEnv,
        },
      });
      toast.success("Configuration enregistrée");
      await configQ.refetch();
    } catch {
      toast.error("La configuration n’a pas pu être enregistrée. Réessayez.");
    } finally {
      setSaving(false);
    }
  };

  const onPing = async (env: "test" | "prod") => {
    if (!org) return;
    const url = (env === "test" ? testUrl : prodUrl).trim();
    setPinging(env);
    try {
      const res = await pingHook({ data: { organizationId: org.id, env, url: url || undefined } });
      if (res.ok) toast.success(`Webhook ${env} OK (HTTP ${res.status})`);
      else toast.error(`Webhook ${env} a échoué (HTTP ${res.status}) — ${res.body || ""}`.trim());
    } catch {
      toast.error("Le test du webhook a échoué. Vérifiez l’adresse puis réessayez.");
    } finally {
      setPinging(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Plateforme — Workflow recrutement (n8n)" />

      <Card>
        <CardContent className="space-y-6 p-6">
          <div>
            <h3 className="font-semibold">Webhooks n8n par organisation</h3>
            <p className="text-sm text-muted-foreground">
              Configurez les URL de webhook pour le workflow n8n de traitement des candidatures.
              Choisissez l'environnement actif (test ou production) à utiliser lors d'une soumission.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="test-url">Webhook de test</Label>
            <div className="flex gap-2">
              <Input
                id="test-url"
                type="url"
                placeholder="https://n8n.exemple.com/webhook-test/…"
                value={testUrl}
                onChange={(e) => setTestUrl(e.target.value)}
              />
              <Button
                variant="outline"
                onClick={() => onPing("test")}
                disabled={!testUrl.trim() || pinging !== null}
                title="Envoyer un ping"
              >
                {pinging === "test" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="prod-url">Webhook de production</Label>
            <div className="flex gap-2">
              <Input
                id="prod-url"
                type="url"
                placeholder="https://n8n.exemple.com/webhook/…"
                value={prodUrl}
                onChange={(e) => setProdUrl(e.target.value)}
              />
              <Button
                variant="outline"
                onClick={() => onPing("prod")}
                disabled={!prodUrl.trim() || pinging !== null}
                title="Envoyer un ping"
              >
                {pinging === "prod" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Environnement actif</Label>
            <RadioGroup value={activeEnv} onValueChange={(v) => setActiveEnv(v as any)} className="grid gap-2 md:grid-cols-3">
              <label htmlFor="env-off" className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 ${activeEnv === "off" ? "border-primary bg-primary/5" : ""}`}>
                <RadioGroupItem value="off" id="env-off" />
                <span className="font-medium">Désactivé</span>
              </label>
              <label htmlFor="env-test" className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 ${activeEnv === "test" ? "border-primary bg-primary/5" : ""}`}>
                <RadioGroupItem value="test" id="env-test" />
                <span className="font-medium">Test</span>
              </label>
              <label htmlFor="env-prod" className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 ${activeEnv === "prod" ? "border-primary bg-primary/5" : ""}`}>
                <RadioGroupItem value="prod" id="env-prod" />
                <span className="font-medium">Production</span>
              </label>
            </RadioGroup>
          </div>

          <div className="flex justify-end">
            <Button onClick={onSave} disabled={saving || !org}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
