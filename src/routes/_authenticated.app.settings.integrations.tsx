import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useOrg } from "@/hooks/useOrg";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, Check, Copy, ExternalLink, Facebook, Linkedin, Loader2, Twitter, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/useConfirm";
import { notMigratedError } from "@/lib/api/pending";
import {
  listSocialAccounts,
  disconnectSocialAccount,
  checkProviderConfig,
} from "@/lib/api/legacy-functions";


export const Route = createFileRoute("/_authenticated/app/settings/integrations")({
  component: IntegrationsPage,
});

type Provider = "facebook" | "linkedin" | "twitter";

const PROVIDERS: Array<{
  id: Provider;
  label: string;
  icon: any;
  color: string;
  consoleUrl: string;
  consoleLabel: string;
  scopes: string[];
  guide: Array<{ title: string; body: string }>;
}> = [
  {
    id: "facebook",
    label: "Facebook",
    icon: Facebook,
    color: "text-[#1877F2]",
    consoleUrl: "https://developers.facebook.com/apps/",
    consoleLabel: "Meta for Developers",
    scopes: ["pages_manage_posts", "pages_read_engagement", "pages_show_list", "public_profile"],
    guide: [
      { title: "1. Créez une app sur Meta for Developers", body: "Connectez-vous, cliquez « Créer une app », choisissez le type « Entreprise », nommez-la (ex : « Konkouré Recrutement »)." },
      { title: "2. Ajoutez le produit « Connexion Facebook »", body: "Dans le tableau de bord de l'app, ajoutez le produit Facebook Login → Paramètres." },
      { title: "3. Ajoutez l'URL de redirection (callback)", body: "Dans Facebook Login → Paramètres → « URI de redirection OAuth valides », collez l'URL de callback ci-dessous." },
      { title: "4. Activez les permissions requises", body: "Sous « Vérification de l'app » → demandez : pages_manage_posts, pages_read_engagement, pages_show_list. En mode développement, votre compte fonctionne sans validation Meta." },
      { title: "5. Récupérez App ID et App Secret", body: "Paramètres de base → copiez l'identifiant et la clé secrète, puis collez-les dans Lovable Cloud." },
      { title: "6. Vous devez avoir une Page Facebook", body: "L'API ne publie pas sur un profil personnel : créez ou utilisez une Page existante administrée par votre compte." },
    ],
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    icon: Linkedin,
    color: "text-[#0A66C2]",
    consoleUrl: "https://www.linkedin.com/developers/apps",
    consoleLabel: "LinkedIn Developers",
    scopes: ["openid", "profile", "w_member_social"],
    guide: [
      { title: "1. Créez une app LinkedIn", body: "Allez sur LinkedIn Developers → « Create app ». Renseignez nom, page LinkedIn associée et logo." },
      { title: "2. Demandez le produit « Share on LinkedIn »", body: "Onglet « Products » → ajoutez « Share on LinkedIn » et « Sign In with LinkedIn using OpenID Connect »." },
      { title: "3. Ajoutez l'URL de redirection", body: "Onglet « Auth » → « Authorized redirect URLs » → ajoutez l'URL de callback ci-dessous." },
      { title: "4. Vérifiez les scopes", body: "Vous devez avoir : openid, profile, w_member_social." },
      { title: "5. Copiez Client ID et Client Secret", body: "Onglet « Auth » → en haut de la page, et collez-les dans Lovable Cloud." },
    ],
  },
  {
    id: "twitter",
    label: "X (Twitter)",
    icon: Twitter,
    color: "text-foreground",
    consoleUrl: "https://developer.twitter.com/en/portal/dashboard",
    consoleLabel: "X Developer Portal",
    scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
    guide: [
      { title: "1. Créez un projet et une app", body: "Sur le Developer Portal X → créez un Projet, puis une App liée. Plan « Free » suffit pour publier des tweets." },
      { title: "2. Activez OAuth 2.0", body: "Onglet « User authentication settings » → activez OAuth 2.0, type « Confidential client », « Web App »." },
      { title: "3. Permissions et URL de callback", body: "Permissions : Read and write. Callback URI : collez l'URL ci-dessous. Website URL : votre site." },
      { title: "4. Récupérez Client ID et Client Secret", body: "Onglet « Keys and tokens » → section OAuth 2.0 Client ID and Secret. Régénérez si besoin." },
    ],
  },
];

function IntegrationsPage() {
  const { t, i18n } = useTranslation();
  const { confirm, confirmDialog } = useConfirm();
  const { org } = useOrg();
  const listFn = listSocialAccounts;
  const disconnectFn = disconnectSocialAccount;
  const checkFn = checkProviderConfig;

  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);

  const accountsQ = useQuery({
    queryKey: ["social_accounts"],
    queryFn: async () => {
      try {
        return await listFn();
      } catch (e) {
        console.error("listSocialAccounts failed", e);
        return { accounts: [] as any[] };
      }
    },
    retry: false,
  });

  const fbCfg = useQuery({ queryKey: ["pcfg", "facebook"], queryFn: () => checkFn({ data: { provider: "facebook" as const } }) });
  const liCfg = useQuery({ queryKey: ["pcfg", "linkedin"], queryFn: () => checkFn({ data: { provider: "linkedin" as const } }) });
  const twCfg = useQuery({ queryKey: ["pcfg", "twitter"], queryFn: () => checkFn({ data: { provider: "twitter" as const } }) });
  const cfgs = { facebook: fbCfg, linkedin: liCfg, twitter: twCfg } as const;

  // Listen for OAuth popup result
  useEffect(() => {
    const expectedOrigin = window.location.origin;
    const handler = (e: MessageEvent) => {
      // Only trust messages from our own origin (OAuth popup served by us).
      if (e.origin !== expectedOrigin) return;
      if (e.data?.type === "oauth_success") {
        toast.success(t("settings.accountConnected"));
        accountsQ.refetch();
      } else if (e.data?.type === "oauth_error") {
        toast.error(e.data.message || t("settings.connectionFailed"));
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const startOAuth = async (provider: Provider) => {
    if (!org) return;
    // TODO(API): OAuth start/callback are not specified in 06-api-reference §8 (only
    // GET/POST /org/integrations/social/accounts). Former route: /api/public/oauth/:provider/start.
    toast.error(notMigratedError(`OAuth ${provider}`).message);
  };

  const disconnect = async (id: string) => {
    if (!(await confirm({ title: t("settings.disconnectConfirm"), description: t("settings.disconnectConfirmDesc"), actionLabel: t("settings.disconnect", { defaultValue: "Déconnecter" }), actionVariant: "destructive" }))) return;
    try {
      await disconnectFn({ data: { id } });
      toast.success(t("settings.accountDisconnected"));
      accountsQ.refetch();
    } catch (e: any) { toast.error(e.message ?? t("settings.genericError")); }
  };

  const accounts = (accountsQ.data?.accounts ?? []) as Array<any>;

  return (
    <div className="space-y-6">
      {confirmDialog}
      <PageHeader
        title={t("settings.integrationsTitle")}
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link to="/app/settings"><ArrowLeft className="mr-2 h-4 w-4" />{t("settings.backToSettings")}</Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="space-y-1 p-4 text-sm">
          <p className="font-medium">{t("settings.howItWorks")}</p>
          <p className="text-muted-foreground">
            {t("settings.howItWorksDesc")}
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="facebook">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          {PROVIDERS.map((p) => (
            <TabsTrigger key={p.id} value={p.id}><p.icon className={`mr-2 h-4 w-4 ${p.color}`} />{p.label}</TabsTrigger>
          ))}
        </TabsList>

        {PROVIDERS.map((p) => {
          const callback = origin ? `${origin}/api/public/oauth/${p.id}/callback` : "";
          const cfg = cfgs[p.id];
          const configured = (cfg.data as any)?.configured;
          const myAccounts = accounts.filter((a) => a.provider === p.id);

          return (
            <TabsContent key={p.id} value={p.id} className="space-y-4 pt-6">
              {/* Connected accounts */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">{t("settings.connectedAccounts")}</h3>
                {accountsQ.isLoading && <p className="text-sm text-muted-foreground">{t("settings.loadingAccounts")}</p>}
                {!accountsQ.isLoading && myAccounts.length === 0 && (
                  <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
                    {t("settings.noAccountConnected", { provider: p.label })}
                  </p>
                )}
                {myAccounts.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 rounded-md border bg-card p-3">
                    <div className="flex items-center gap-3">
                      <p.icon className={`h-5 w-5 ${p.color}`} />
                      <div>
                        <p className="font-medium">{a.account_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t("settings.connectedOn", { date: new Date(a.connected_at).toLocaleDateString(i18n.language === "en" ? "en-US" : "fr-FR") })}
                        </p>
                        <Badge variant={a.status === "active" ? "default" : "secondary"} className="mt-1">{String(a.status)}</Badge>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => disconnect(a.id)}>
                      <Trash2 className="mr-1 h-4 w-4 text-destructive" />{t("settings.disconnect")}
                    </Button>
                  </div>
                ))}
              </div>

              {/* Connect button */}
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{t("settings.connectAccount", { provider: p.label })}</p>
                    <p className="text-xs text-muted-foreground">
                      {configured ? t("settings.configOk") : t("settings.configMissing")}
                    </p>
                  </div>
                  <Button onClick={() => startOAuth(p.id)} disabled={!configured || !org}>
                    {cfg.isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <p.icon className={`mr-2 h-4 w-4`} />}
                    {t("settings.connect")}
                  </Button>
                </div>
                {!configured && !!cfg.data && (
                  <div className="mt-3 flex items-start gap-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>
                      {t("settings.missingVars", {
                        clientId: (cfg.data as any).clientIdEnv,
                        clientSecret: (cfg.data as any).clientSecretEnv,
                      })}
                    </span>
                  </div>
                )}
              </div>

              {/* Guide */}
              <Card>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold">{t("settings.guideTitle", { provider: p.label })}</h3>
                    <Button variant="outline" size="sm" asChild>
                      <a href={p.consoleUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-1 h-3 w-3" />{t("settings.openConsole", { console: p.consoleLabel })}
                      </a>
                    </Button>
                  </div>

                  <div className="space-y-2 rounded-md border bg-muted/40 p-3">
                    <p className="text-xs font-medium">{t("settings.callbackUrlLabel")}</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 break-all rounded bg-background px-2 py-1 text-xs">{callback || "…"}</code>
                      <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(callback); toast.success(t("settings.urlCopied")); }}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2 rounded-md border bg-muted/40 p-3">
                    <p className="text-xs font-medium">{t("settings.scopesLabel")}</p>
                    <div className="flex flex-wrap gap-1">
                      {p.scopes.map((s) => <Badge key={s} variant="secondary" className="font-mono text-[10px]">{s}</Badge>)}
                    </div>
                  </div>

                  <Accordion type="single" collapsible className="w-full">
                    {p.guide.map((g, i) => (
                      <AccordionItem key={i} value={`step-${i}`}>
                        <AccordionTrigger className="text-sm">{g.title}</AccordionTrigger>
                        <AccordionContent className="text-sm text-muted-foreground">{g.body}</AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>

                  <div className="rounded-md border-l-4 border-primary bg-primary/5 p-3 text-sm">
                    <p className="font-medium flex items-center gap-1"><Check className="h-3 w-3" />{t("settings.afterCreateTitle")}</p>
                    <p className="mt-1 text-muted-foreground">
                      {t("settings.afterCreateDesc", {
                        clientId: (cfg.data as any)?.clientIdEnv,
                        clientSecret: (cfg.data as any)?.clientSecretEnv,
                      })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
