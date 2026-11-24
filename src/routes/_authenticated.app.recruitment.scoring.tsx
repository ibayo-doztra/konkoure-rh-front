import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Copy, KeyRound, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/api/client";
import {
  pingWebhook,
  updateWebhookConfig,
  webhookConfigQuery,
  type WebhookConfig,
  type WebhookEnv,
  type WebhookPing,
} from "@/lib/api/recruitment";
import { formatDateTime } from "@/lib/format";
import { useOrg } from "@/hooks/useOrg";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export const Route = createFileRoute("/_authenticated/app/recruitment/scoring")({
  component: ScoringSettingsPage,
});

const ENVS: WebhookEnv[] = ["off", "test", "prod"];

/**
 * n8n scoring webhook of the organization (owner, hr_admin). Public
 * applications are sent, signed, to the active environment; the result comes
 * back on the candidate card (score, strengths, CV alerts).
 */
function ScoringSettingsPage() {
  const { t } = useTranslation();
  const { org } = useOrg();
  const organizationId = org?.id ?? "";
  const config = useQuery({ ...webhookConfigQuery(organizationId), enabled: !!org });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("recruitment.scoring.title")}
        description={t("recruitment.scoring.description")}
      />
      {config.isPending ? (
        <Skeleton className="h-96 w-full" />
      ) : config.isError ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">
            {apiErrorMessage(config.error)}
          </CardContent>
        </Card>
      ) : (
        <WebhookForm organizationId={organizationId} config={config.data} />
      )}
    </div>
  );
}

function WebhookForm({
  organizationId,
  config,
}: {
  organizationId: string;
  config: WebhookConfig;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [testUrl, setTestUrl] = useState(config.testWebhookUrl ?? "");
  const [prodUrl, setProdUrl] = useState(config.prodWebhookUrl ?? "");
  const [activeEnv, setActiveEnv] = useState<WebhookEnv>(config.activeEnv);
  const [secret, setSecret] = useState<string | null>(null);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [lastPing, setLastPing] = useState<WebhookPing | null>(null);

  useEffect(() => {
    setTestUrl(config.testWebhookUrl ?? "");
    setProdUrl(config.prodWebhookUrl ?? "");
    setActiveEnv(config.activeEnv);
  }, [config]);

  const dirty =
    testUrl.trim() !== (config.testWebhookUrl ?? "") ||
    prodUrl.trim() !== (config.prodWebhookUrl ?? "") ||
    activeEnv !== config.activeEnv;

  const onSaved = (saved: WebhookConfig & { secret?: string }) => {
    const { secret: created, ...rest } = saved;
    queryClient.setQueryData(webhookConfigQuery(organizationId).queryKey, rest);
    if (created) setSecret(created);
  };

  const save = useMutation({
    mutationFn: () =>
      updateWebhookConfig({
        testWebhookUrl: testUrl.trim() || null,
        prodWebhookUrl: prodUrl.trim() || null,
        activeEnv,
      }),
    onSuccess: (saved) => {
      toast.success(t("recruitment.scoring.saved"));
      onSaved(saved);
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const rotate = useMutation({
    mutationFn: () => updateWebhookConfig({ rotateSecret: true }),
    onSuccess: (saved) => {
      setConfirmRotate(false);
      onSaved(saved);
    },
    onError: (e) => {
      setConfirmRotate(false);
      toast.error(apiErrorMessage(e));
    },
  });

  const ping = useMutation({
    mutationFn: (env: "test" | "prod") => pingWebhook(env),
    onSuccess: setLastPing,
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const urlField = (env: "test" | "prod", value: string, onChange: (v: string) => void) => {
    const saved = env === "test" ? config.testWebhookUrl : config.prodWebhookUrl;
    return (
      <div className="space-y-2">
        <Label htmlFor={`webhook-${env}`}>{t(`recruitment.scoring.url.${env}`)}</Label>
        <div className="flex gap-2">
          <Input
            id={`webhook-${env}`}
            type="url"
            inputMode="url"
            maxLength={2000}
            placeholder={t(`recruitment.scoring.url.${env}Placeholder`)}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <Button
            variant="outline"
            onClick={() => ping.mutate(env)}
            // The API pings the saved URL: save the form first.
            disabled={!saved || saved !== value.trim() || ping.isPending}
            aria-label={t("recruitment.scoring.ping", { env: t(`recruitment.scoring.env.${env}`) })}
            title={t("recruitment.scoring.ping", { env: t(`recruitment.scoring.env.${env}`) })}
          >
            {ping.isPending && ping.variables === env ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <>
      <Card>
        <CardContent className="space-y-6 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">{t("recruitment.scoring.webhookTitle")}</h2>
            {config.activeEnv === "off" ? (
              <Badge variant="secondary">{t("recruitment.scoring.statusOff")}</Badge>
            ) : (
              <Badge variant="success">
                {t("recruitment.scoring.statusOn", {
                  env: t(`recruitment.scoring.env.${config.activeEnv}`),
                })}
              </Badge>
            )}
          </div>

          {urlField("test", testUrl, setTestUrl)}
          {urlField("prod", prodUrl, setProdUrl)}
          <p className="text-xs text-muted-foreground">{t("recruitment.scoring.urlHint")}</p>

          {lastPing && (
            <div
              role="status"
              className={`rounded-md border p-3 text-sm ${
                lastPing.ok
                  ? "border-success/40 bg-success/10 text-success"
                  : "border-destructive/40 bg-destructive/10 text-destructive"
              }`}
            >
              {lastPing.ok
                ? t("recruitment.scoring.pingOk", {
                    env: t(`recruitment.scoring.env.${lastPing.env}`),
                    status: lastPing.status,
                    ms: lastPing.latencyMs ?? 0,
                  })
                : t("recruitment.scoring.pingFailed", {
                    env: t(`recruitment.scoring.env.${lastPing.env}`),
                    reason:
                      lastPing.error ?? (lastPing.status != null ? `HTTP ${lastPing.status}` : "—"),
                  })}
            </div>
          )}

          <div className="space-y-2">
            <Label id="webhook-env-label">{t("recruitment.scoring.activeEnv")}</Label>
            <RadioGroup
              aria-labelledby="webhook-env-label"
              value={activeEnv}
              onValueChange={(v) => setActiveEnv(v as WebhookEnv)}
              className="grid gap-2 sm:grid-cols-3"
            >
              {ENVS.map((env) => (
                <label
                  key={env}
                  htmlFor={`env-${env}`}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 ${
                    activeEnv === env ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <RadioGroupItem value={env} id={`env-${env}`} />
                  <span className="font-medium">{t(`recruitment.scoring.env.${env}`)}</span>
                </label>
              ))}
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              {t("recruitment.scoring.activeEnvHint")}
            </p>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("common.save")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 font-semibold">
              <KeyRound className="h-4 w-4" />
              {t("recruitment.scoring.secretTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {config.hasSecret
                ? t("recruitment.scoring.secretSet")
                : t("recruitment.scoring.secretMissing")}
            </p>
            {config.updatedAt && (
              <p className="text-xs text-muted-foreground">
                {t("recruitment.scoring.updatedAt", { date: formatDateTime(config.updatedAt) })}
              </p>
            )}
          </div>
          {config.hasSecret && (
            <Button
              variant="outline"
              className="shrink-0"
              onClick={() => setConfirmRotate(true)}
              disabled={rotate.isPending}
            >
              {t("recruitment.scoring.rotate")}
            </Button>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmRotate}
        onOpenChange={setConfirmRotate}
        title={t("recruitment.scoring.rotateConfirmTitle")}
        description={t("recruitment.scoring.rotateConfirmDesc")}
        actionLabel={t("recruitment.scoring.rotate")}
        actionVariant="destructive"
        loading={rotate.isPending}
        onConfirm={() => rotate.mutate()}
      />

      <SecretDialog secret={secret} onClose={() => setSecret(null)} />
    </>
  );
}

/** The secret is shown once: closing the dialog forgets it. */
function SecretDialog({ secret, onClose }: { secret: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  const copy = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      toast.success(t("recruitment.scoring.secretCopied"));
    } catch {
      toast.error(t("recruitment.scoring.copyFailed"));
    }
  };
  return (
    <Dialog open={!!secret} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("recruitment.scoring.secretDialogTitle")}</DialogTitle>
          <DialogDescription>{t("recruitment.scoring.secretDialogDesc")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <code
            data-testid="webhook-secret"
            className="block break-all rounded-md border bg-muted px-3 py-2 font-mono text-xs"
          >
            {secret}
          </code>
          <DialogActions>
            <Button variant="outline" onClick={copy}>
              <Copy className="mr-1.5 h-4 w-4" />
              {t("recruitment.scoring.copy")}
            </Button>
            <Button onClick={onClose}>{t("recruitment.scoring.secretSaved")}</Button>
          </DialogActions>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
